import { MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import { z } from "zod"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z.url("errors:quizz.invalidMediaUrl"),
})

const questionValidator = z
  .object({
    type: z
      .enum([QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.WORD_CLOUD, QUESTION_TYPES.NUMERIC])
      .default(QUESTION_TYPES.MULTIPLE_CHOICE),
    disableTimers: z.boolean().default(false),
    disablePreviewTimer: z.boolean().default(false),
    disableAnswerTimer: z.boolean().default(false),
    previewAnswers: z.boolean().default(false),
    question: z.string().min(1, "errors:quizz.questionEmpty"),
    numericSolution: z.number().nonnegative().optional(),
    media: questionMediaValidator.optional(),
    wordCloud: z
      .object({
        allowMultipleAnswers: z.boolean().default(false),
        showLiveResponses: z.boolean().default(false),
      })
      .optional(),
    answers: z
      .array(z.string().min(1, "errors:quizz.answerEmpty"))
      .max(4, "errors:quizz.tooManyAnswers")
      .default([]),
    solutions: z
      .preprocess(
        (value) => (typeof value === "number" ? [value] : value),
        z.array(z.number().int().min(0)),
      )
      .default([]),
    cooldown: z.number().int().min(3).max(15),
    time: z.number().int().min(5).max(120),
  })
  .superRefine((question, ctx) => {
    if (question.type === QUESTION_TYPES.WORD_CLOUD) {
      return
    }

    if (question.type === QUESTION_TYPES.NUMERIC) {
      if (typeof question.numericSolution !== "number") {
        ctx.addIssue({
          code: "custom",
          path: ["numericSolution"],
          message: "errors:quizz.failedToSave",
        })

        return
      }

      return
    }

    if (question.answers.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["answers"],
        message: "errors:quizz.tooFewAnswers",
      })
    }

    if (question.solutions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["solutions"],
        message: "errors:quizz.failedToSave",
      })

      return
    }

    const hasOutOfRangeSolution = question.solutions.some(
      (solution) => solution >= question.answers.length,
    )

    if (hasOutOfRangeSolution) {
      ctx.addIssue({
        code: "custom",
        path: ["solutions"],
        message: "errors:quizz.failedToSave",
      })
    }
  })
  .transform((question) => {
    if (question.type === QUESTION_TYPES.WORD_CLOUD) {
      return {
        ...question,
        wordCloud: {
          allowMultipleAnswers:
            question.wordCloud?.allowMultipleAnswers ?? false,
          showLiveResponses: question.wordCloud?.showLiveResponses ?? false,
        },
        answers: [],
        solutions: [],
      }
    }

    if (question.type === QUESTION_TYPES.NUMERIC) {
      return {
        ...question,
        answers: [],
        solutions: [],
      }
    }

    return {
      ...question,
      wordCloud: undefined,
    }
  })

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
})

export type QuizzValidated = z.infer<typeof quizzValidator>
