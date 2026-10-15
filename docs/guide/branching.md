# Answer paths

An answer path sends people to a different next screen depending on what they answered. Use it to ask a follow-up only to people who need one, to skip questions that do not apply, or to end different groups on different completion screens. This page explains how paths work and how to set them up.

## How a path is chosen

Every question has two things that decide where a respondent goes next:

1. **Rules**, which you add in the **Answer paths** section of the question's settings. They are checked in the order shown, and the first rule that matches wins.
2. A **Default next screen**, used when no rule matches. It is always required.

If an answer matches no rule, the person goes to the default. A flow with no rules at all is simply a straight line of default screens.

A rule belongs to one question and looks only at that question's own answer. Pencil has no calculations, no combining of several answers in one rule and no answer piping into later wording.

## Add a rule

1. Select a question in the builder.
2. In **Answer paths**, choose **Add rule**. It appears as **Rule 1**.
3. Choose what to match (see the table below).
4. Under **Then go to**, choose any other question or any completion screen. Welcome screens cannot be a destination.
5. Choose **Save**.

Rules run top to bottom. Use the arrows next to a rule to move it earlier or later, and **Remove rule** to delete it. The panel reminds you: first matching rule wins, in this order, otherwise the default next screen.

Changing a question's type clears its rules, because a rule written for one type makes no sense for another.

## What you can match

Only some question types can have rules. Short text, long text and email answers are free text, so they cannot.

| Question type | What a rule can ask |
|---|---|
| **Single choice**, **Dropdown** | Is the answer a particular choice? You pick it under **Answer**. |
| **Yes / No** | Is the answer **Yes** or **No**? |
| **Consent** | Was it **Accepted** or **Declined**? |
| **Multiple choice** | Does the answer **contains any of** the ticked choices, or **contains all of** them? |
| **Rating**, **NPS**, **Number** | Compare the number with a value you enter: **is**, **is greater than**, **is at least**, **is less than**, **is at most**. |
| **Date** | The same five comparisons, against a date. |
| **Priority** | Either **is** an exact complete ordering that you build, or compare one option's position, using **Option** and **Rank**, with the same five comparisons. |

For a rating, NPS or number rule, the number box under the comparison is labelled **Rating**.

## An example

This is an illustration, not something Pencil adds for you. Say your flow has an NPS question, then "What went wrong?", then "What did we get right?", then a completion screen.

On the NPS question:

- **Rule 1**: **Match** is at most, the number **6**, **Then go to** "What went wrong?".
- **Rule 2**: **Match** is at least, the number **9**, **Then go to** "What did we get right?".
- **Default next screen**: the completion screen.

A person who scores 4 is asked what went wrong. A person who scores 10 is asked what went right. A person who scores 8 matches nothing and goes straight to the completion screen. Each of the two follow-up questions needs its own **Default next screen** too, normally the completion screen.

## Required questions and skipped questions

A required question only blocks people who reach it. If their answers route them around it, it is never shown, never counted as unanswered and never stops them from finishing. Publishing does not demand that a required question sits on every path.

The progress line respondents see (for example **Question 2 of 3** and **1 remaining**) counts only the questions they can still reach given their answers so far. If someone goes back and changes an answer, Pencil works out their path again and drops any answers they gave on screens that are no longer on it.

## Test the paths

Choose **Preview draft** and answer as different kinds of respondent. After each screen, choose **Inspect answer path**. **Evaluated path** lists every rule on every screen visited, for example "Rule 1: matches" or "Rule 2: does not match", marks the one that was **chosen**, and says whether the next screen came from the first matching rule or the default path. Nothing you do in a preview is recorded. See [Build a form](build-a-form.md#preview-your-flow).

## What publishing checks

When you choose **Publish**, Pencil checks the whole flow before it makes a revision:

- Every rule points at a question and choice that exist, and every destination is a real question or completion screen.
- The first step is the welcome screen, or the first question if there is none.
- Every step can be reached from the start by at least one path. A question you have just added is not connected yet: point an earlier question's rule or **Default next screen** at it first, or Publish refuses it as unreachable.
- Every possible path ends at a completion screen, and none loops back on itself.
- Every question has a prompt, every choice question has valid and distinct options, and there is at least one question.

If anything fails, Pencil lists every step involved with the reason. It creates no revision and your draft stays editable, so you can fix all the problems at once and publish again. Continue with [Publish and share](publish-and-share.md).
