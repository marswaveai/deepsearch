import { getTokenBudgetAndMaxAttempts } from "./app";
import { ActionTracker } from "./utils/action-tracker";
import { TokenTracker } from "./utils/token-tracker";
export { AnswerAction } from "./types";

export const getAgentOptions = () => ({
  ...getTokenBudgetAndMaxAttempts("medium"),
  context: {
    tokenTrakcer: new TokenTracker(),
    actionTracker: new ActionTracker(),
  },
  messages: [],
  maxReturnedUrls: 75, // HACK: decrease from 100 to 75
  noDirectAnswer: undefined,
  boostHostnames: [],
  badHostnames: [],
});
