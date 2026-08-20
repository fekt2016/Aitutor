import { describe, it, expect } from "vitest";
import { suggestIntent } from "./intents";

describe("suggestIntent (§10.1) — deterministic intent hints", () => {
  it("flags a help request as a hint", () => {
    expect(suggestIntent({ message: "I'm stuck, give me a hint", lastTurnAskedQuestion: false, turnCount: 3 })).toBe("hint");
    expect(suggestIntent({ message: "too hard", lastTurnAskedQuestion: false, turnCount: 1 })).toBe("hint");
  });

  it("greeting at turn 0 is smalltalk", () => {
    expect(suggestIntent({ message: "Hi Eazi!", lastTurnAskedQuestion: false, turnCount: 0 })).toBe("smalltalk");
  });

  it("greeting mid-session is NOT forced to smalltalk (model decides freely)", () => {
    expect(suggestIntent({ message: "hello", lastTurnAskedQuestion: false, turnCount: 2 })).toBe("explain");
  });

  it("goodbye suggests session_end", () => {
    expect(suggestIntent({ message: "bye bye", lastTurnAskedQuestion: false, turnCount: 5 })).toBe("session_end");
  });

  it("thanks is smalltalk", () => {
    expect(suggestIntent({ message: "thank you!", lastTurnAskedQuestion: false, turnCount: 4 })).toBe("smalltalk");
  });

  it("answering the tutor's question becomes practice", () => {
    expect(suggestIntent({ message: "the answer is 8", lastTurnAskedQuestion: true, turnCount: 2 })).toBe("practice");
  });

  it("plain request mid-session is explain", () => {
    expect(suggestIntent({ message: "how do I add tens?", lastTurnAskedQuestion: false, turnCount: 2 })).toBe("explain");
  });

  it("brand-new session with no greeting lets the model decide", () => {
    expect(suggestIntent({ message: "what can we learn today", lastTurnAskedQuestion: false, turnCount: 0 })).toBeNull();
  });
});