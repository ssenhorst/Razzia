import { QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionType } from "@razzia/common/types/game"
import ConfigField from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigField"
import ConfigNumberInput from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigNumberInput"
import ConfigSection from "@razzia/web/features/quizz/components/QuestionEditor/QuestionEditorConfig/ConfigSection"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import {
    Activity,
    Clock,
    MessageSquareText,
    Repeat,
    Timer,
    TimerOff,
} from "lucide-react"
import { useTranslation } from "react-i18next"

const QuestionEditorConfig = () => {
  const { currentQuestion, currentIndex, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()

  const handleUpdateQuestion = (key: string) => (value: string | number) => {
    updateQuestion(currentIndex, { [key]: value })
  }

  const handleQuestionTypeChange = (value: QuestionType) => {
    if (value === QUESTION_TYPES.NUMERIC) {
      updateQuestion(currentIndex, {
        type: QUESTION_TYPES.NUMERIC,
        answers: [],
        solutions: [],
        numericSolution: 0,
      })

      return
    }

    if (value === QUESTION_TYPES.WORD_CLOUD) {
      updateQuestion(currentIndex, {
        type: QUESTION_TYPES.WORD_CLOUD,
        wordCloud: {
          allowMultipleAnswers: false,
          showLiveResponses: false,
        },
        answers: [],
        solutions: [],
      })

      return
    }

    updateQuestion(currentIndex, {
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      wordCloud: undefined,
      answers:
        currentQuestion.answers.length >= 2
          ? currentQuestion.answers
          : ["", ""],
      solutions:
        currentQuestion.solutions.length > 0 ? currentQuestion.solutions : [0],
    })
  }

  const handleWordCloudOptionChange =
    (key: "allowMultipleAnswers" | "showLiveResponses") => (value: boolean) => {
      updateQuestion(currentIndex, {
        wordCloud: {
          allowMultipleAnswers:
            currentQuestion.wordCloud?.allowMultipleAnswers ?? false,
          showLiveResponses:
            currentQuestion.wordCloud?.showLiveResponses ?? false,
          [key]: value,
        },
      })
    }

  return (
    <aside className="z-10 m-3 flex w-68 shrink-0 flex-col gap-6 self-start overflow-auto rounded-xl bg-white p-4 shadow-sm">
      <ConfigSection title={t("quizz:question.config.response")}>
        <ConfigField>
          <ConfigField.Label
            icon={<MessageSquareText className="size-4" />}
            label={t("quizz:question.config.responseType")}
          />

          <select
            value={currentQuestion.type ?? QUESTION_TYPES.MULTIPLE_CHOICE}
            onChange={(event) =>
              handleQuestionTypeChange(event.target.value as QuestionType)
            }
            className="h-8 rounded-md border border-gray-200 px-2 text-sm"
          >
            <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>
              {t("quizz:question.types.multipleChoice")}
            </option>
            <option value={QUESTION_TYPES.WORD_CLOUD}>
              {t("quizz:question.types.wordCloud")}
            </option>
              <option value={QUESTION_TYPES.NUMERIC}>
                {t("quizz:question.types.numeric")}
              </option>
          </select>

          <ConfigField.Description>
            {t("quizz:question.config.responseTypeHint")}
          </ConfigField.Description>
        </ConfigField>

        {currentQuestion.type === QUESTION_TYPES.NUMERIC && (
          <ConfigField>
            <ConfigField.Label
              icon={<Activity className="size-4" />}
              label={t("quizz:question.config.numericSolution")}
            />
            <ConfigNumberInput
              value={currentQuestion.numericSolution ?? 0}
              min={0}
              onChange={handleUpdateQuestion("numericSolution")}
            />
            <ConfigField.Description>
              {t("quizz:question.config.numericSolutionHint")}
            </ConfigField.Description>
          </ConfigField>
        )}

        {currentQuestion.type === QUESTION_TYPES.WORD_CLOUD && (
          <>
            <ConfigField>
              <ConfigField.Label
                icon={<Repeat className="size-4" />}
                label={t("quizz:question.config.allowMultipleAnswers")}
                unit={null}
              />
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={
                    currentQuestion.wordCloud?.allowMultipleAnswers ?? false
                  }
                  onChange={(event) =>
                    handleWordCloudOptionChange("allowMultipleAnswers")(
                      event.target.checked,
                    )
                  }
                />
                {t("quizz:question.config.enabled")}
              </label>
              <ConfigField.Description>
                {t("quizz:question.config.allowMultipleAnswersHint")}
              </ConfigField.Description>
            </ConfigField>

            <ConfigField>
              <ConfigField.Label
                icon={<Activity className="size-4" />}
                label={t("quizz:question.config.showLiveResponses")}
                unit={null}
              />
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={
                    currentQuestion.wordCloud?.showLiveResponses ?? false
                  }
                  onChange={(event) =>
                    handleWordCloudOptionChange("showLiveResponses")(
                      event.target.checked,
                    )
                  }
                />
                {t("quizz:question.config.enabled")}
              </label>
              <ConfigField.Description>
                {t("quizz:question.config.showLiveResponsesHint")}
              </ConfigField.Description>
            </ConfigField>
          </>
        )}
      </ConfigSection>

      <ConfigSection title={t("quizz:question.config.timings")}>
        <ConfigField>
          <ConfigField.Label
            icon={<TimerOff className="size-4" />}
            label={t("quizz:question.config.disablePreviewTimer")}
            unit={null}
          />
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={currentQuestion.disablePreviewTimer ?? false}
              onChange={(event) =>
                updateQuestion(currentIndex, {
                  disablePreviewTimer: event.target.checked,
                })
              }
            />
            {t("quizz:question.config.enabled")}
          </label>
          <ConfigField.Description>
            {t("quizz:question.config.disablePreviewTimerHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<TimerOff className="size-4" />}
            label={t("quizz:question.config.previewAnswers")}
            unit={null}
          />
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={currentQuestion.previewAnswers ?? false}
              onChange={(event) =>
                updateQuestion(currentIndex, {
                  previewAnswers: event.target.checked,
                })
              }
            />
            {t("quizz:question.config.enabled")}
          </label>
          <ConfigField.Description>
            {t("quizz:question.config.previewAnswersHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<TimerOff className="size-4" />}
            label={t("quizz:question.config.disableAnswerTimer")}
            unit={null}
          />
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={currentQuestion.disableAnswerTimer ?? false}
              onChange={(event) =>
                updateQuestion(currentIndex, {
                  disableAnswerTimer: event.target.checked,
                })
              }
            />
            {t("quizz:question.config.enabled")}
          </label>
          <ConfigField.Description>
            {t("quizz:question.config.disableAnswerTimerHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<Clock className="size-4" />}
            label={t("quizz:question.config.questionDisplay")}
          />
          <ConfigNumberInput
            value={currentQuestion.cooldown}
            min={3}
            onChange={handleUpdateQuestion("cooldown")}
          />
          <ConfigField.Description>
            {t("quizz:question.config.questionDisplayHint")}
          </ConfigField.Description>
        </ConfigField>

        <ConfigField>
          <ConfigField.Label
            icon={<Timer className="size-4" />}
            label={t("quizz:question.config.answerTime")}
          />
          <ConfigNumberInput
            value={currentQuestion.time}
            min={5}
            onChange={handleUpdateQuestion("time")}
          />
          <ConfigField.Description>
            {t("quizz:question.config.answerTimeHint")}
          </ConfigField.Description>
        </ConfigField>
      </ConfigSection>
    </aside>
  )
}

export default QuestionEditorConfig
