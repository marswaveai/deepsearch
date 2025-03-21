import { TrackerContext } from "../types";
import axios from "axios";
import { JINA_API_KEY } from "../config";
import { Schemas } from "../utils/schemas";

export async function cherryPick(
  question: string,
  longContext: string,
  options: any = {},
  trackers: TrackerContext,
  schemaGen: Schemas,
  url: string,
) {
  const {
    snippetLength = 3000, // char length of each snippet
    numSnippets = Math.max(
      2,
      Math.min(5, Math.floor(longContext.length / snippetLength)),
    ),
    chunkSize = 300, // char length of each chunk
  } = options;

  const maxTokensPerRequest = 8192; // Maximum tokens per embedding request

  // Rough estimate of tokens per character (can be adjusted based on your text)
  const tokensPerCharacter = 0.4;

  if (longContext.length < snippetLength * 2) {
    // If the context is shorter than the snippet length, return the whole context
    console.log("content is too short, dont bother");
    return longContext;
  }

  // Split the longContext into chunks of chunkSize
  const chunks: string[] = [];
  for (let i = 0; i < longContext.length; i += chunkSize) {
    chunks.push(
      longContext.substring(i, Math.min(i + chunkSize, longContext.length)),
    );
  }

  console.log("late chunking enabled! num chunks:", chunks.length);

  trackers.actionTracker.trackThink("late_chunk", schemaGen.languageCode, {
    url,
  });

  try {
    if (question.trim().length === 0) {
      throw new Error("Empty question, returning full context");
    }

    // Estimate the number of tokens per chunk
    const estimatedTokensPerChunk = Math.ceil(chunkSize * tokensPerCharacter);

    // Calculate chunks per batch to stay under token limit
    const chunksPerBatch = Math.floor(
      maxTokensPerRequest / estimatedTokensPerChunk,
    );

    // Create batches of chunks
    const chunkBatches = [];
    for (let i = 0; i < chunks.length; i += chunksPerBatch) {
      chunkBatches.push(chunks.slice(i, i + chunksPerBatch));
    }

    console.log(
      `Total length ${longContext.length} split ${chunks.length} chunks into ${chunkBatches.length} batches of ~${chunksPerBatch} chunks each`,
    );

    // Process each batch and collect the embeddings
    const allChunkEmbeddings: number[][] = [];
    let totalTokensUsed = 0;

    for (let batchIndex = 0; batchIndex < chunkBatches.length; batchIndex++) {
      const batch = chunkBatches[batchIndex];
      console.log(
        `Processing batch ${batchIndex + 1}/${chunkBatches.length} with ${batch.length} chunks`,
      );

      // Get embeddings for the current batch
      const batchEmbeddingResponse = await axios.post(
        "https://api.jina.ai/v1/embeddings",
        {
          model: "jina-embeddings-v3",
          task: "retrieval.passage",
          late_chunking: true,
          dimensions: 1024,
          embedding_type: "float",
          input: batch,
          truncate: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${JINA_API_KEY}`,
          },
        },
      );

      if (batchEmbeddingResponse.status !== 200) {
        throw new Error(
          `Unexpected status code from API: ${batchEmbeddingResponse.status}`,
        );
      }

      // Validate response structure
      if (!batchEmbeddingResponse.data?.data) {
        throw new Error("Unexpected API response format");
      }

      // Extract embeddings from this batch
      const batchEmbeddings = batchEmbeddingResponse.data.data.map(
        (item: any) => item.embedding,
      );
      allChunkEmbeddings.push(...batchEmbeddings);

      // Track token usage
      const batchTokens = batchEmbeddingResponse.data.usage?.total_tokens || 0;
      totalTokensUsed += batchTokens;
    }

    // Get embedding for the question
    const questionEmbeddingResponse = await axios.post(
      "https://api.jina.ai/v1/embeddings",
      {
        model: "jina-embeddings-v3",
        task: "retrieval.query",
        dimensions: 1024,
        embedding_type: "float",
        input: [question],
        truncate: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JINA_API_KEY}`,
        },
      },
    );

    if (questionEmbeddingResponse.status !== 200) {
      throw new Error("Unexpected status code from API");
    }

    // Validate question embedding response
    if (
      !questionEmbeddingResponse.data?.data ||
      !questionEmbeddingResponse.data.data[0]?.embedding
    ) {
      throw new Error("Question embedding not found in API response");
    }

    // Track token usage for question embedding
    const questionTokens =
      questionEmbeddingResponse.data.usage?.total_tokens || 0;
    totalTokensUsed += questionTokens;

    // Track total token usage
    trackers.tokenTracker.trackUsage("latechunk", {
      promptTokens: totalTokensUsed,
      completionTokens: 0,
      totalTokens: totalTokensUsed,
    });

    const questionEmbedding = questionEmbeddingResponse.data.data[0].embedding;

    // Verify that we got embeddings for all chunks
    if (allChunkEmbeddings.length !== chunks.length) {
      console.error(
        `Got ${allChunkEmbeddings.length} embeddings for ${chunks.length} chunks`,
      );
    }

    // Calculate cosine similarity between the question and each chunk
    const similarities = allChunkEmbeddings.map((chunkEmbed: number[]) => {
      return cosineSimilarity(questionEmbedding, chunkEmbed);
    });

    // Calculate the number of chunks needed for a single snippet
    const chunksPerSnippet = Math.ceil(snippetLength / chunkSize);

    // Find the top `numSnippets` snippets with highest average similarity
    const snippets: string[] = [];

    // Create a copy of similarities to avoid modifying the original
    const similaritiesCopy = [...similarities];

    for (let i = 0; i < numSnippets; i++) {
      // Find the best starting position for the snippet
      let bestStartIndex = 0;
      let bestScore = -Infinity;

      // Check each possible starting position for a snippet
      for (let j = 0; j <= similarities.length - chunksPerSnippet; j++) {
        // Calculate the average similarity for the current window
        const windowScores = similaritiesCopy.slice(j, j + chunksPerSnippet);
        const windowScore =
          windowScores.reduce((sum, score) => sum + score, 0) /
          windowScores.length;

        if (windowScore > bestScore) {
          bestScore = windowScore;
          bestStartIndex = j;
        }
      }

      // Extract the snippet text
      const startIndex = bestStartIndex * chunkSize;
      const endIndex = Math.min(startIndex + snippetLength, longContext.length);
      snippets.push(longContext.substring(startIndex, endIndex));

      // Mark the used chunks with a very low score to avoid reusing them
      for (
        let k = bestStartIndex;
        k < bestStartIndex + chunksPerSnippet && k < similaritiesCopy.length;
        k++
      ) {
        similaritiesCopy[k] = -Infinity;
      }
    }

    // wrap with <snippet-index> tag
    return snippets
      .map((snippet, index) =>
        `
<snippet-${index + 1}>

${snippet}

</snippet-${index + 1}>`.trim(),
      )
      .join("\n\n");
  } catch (error) {
    console.error("Error in late chunking:", error);
    // Fallback: just return the beginning of the context up to the desired length
    return longContext.substring(0, snippetLength * numSnippets);
  }
}

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

