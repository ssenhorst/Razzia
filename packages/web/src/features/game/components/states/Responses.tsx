import { QUESTION_TYPES } from "@razzia/common/constants"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
  SFX,
} from "@razzia/web/features/game/utils/constants"
import { calculatePercentages } from "@razzia/web/features/game/utils/score"
import clsx from "clsx"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: ManagerStatusDataMap["SHOW_RESPONSES"]
}

const Responses = ({
  data: { question, answers, responses, solutions, questionType, finalized },
}: Props) => {
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const isWordCloud = questionType === QUESTION_TYPES.WORD_CLOUD
  const { t } = useTranslation()

  const wordResponses = useMemo(
    () =>
      Object.entries(responses)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 25),
    [responses],
  )

  const maxWordCount = useMemo(
    () => Math.max(1, ...wordResponses.map(([, count]) => count)),
    [wordResponses],
  )

  const [sfxResults] = useSound(SFX.RESULTS_SOUND, {
    volume: 0.2,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    onplay: () => {
      setIsMusicPlaying(true)
    },
    onend: () => {
      setIsMusicPlaying(false)
    },
  })

  useEffect(() => {
    stopMusic()
    sfxResults()

    setPercentages(calculatePercentages(responses))
  }, [responses, playMusic, stopMusic, sfxResults])

  useEffect(() => {
    if (!isMusicPlaying) {
      playMusic()
    }
  }, [isMusicPlaying, playMusic])

  useEffect(() => {
    stopMusic()
  }, [playMusic, stopMusic])

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        {finalized === false && (
          <div className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">
            {t("game:liveResponses")}
          </div>
        )}

        {isWordCloud ? (
          <div className="mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-xl bg-black/25 p-5">
            {wordResponses.length > 0 ? (
              wordResponses.map(([word, count]) => {
                const weight = Math.log(count + 1) / Math.log(maxWordCount + 1)
                const fontSize = `${Math.round(14 + weight * 52)}px`
                const opacity = 0.65 + weight * 0.35

                return (
                  <span
                    key={word}
                    style={{ fontSize, opacity }}
                    className="rounded-full bg-white/15 px-3 py-1 font-bold text-white"
                  >
                    {word}
                  </span>
                )
              })
            ) : (
              <span className="text-xl font-semibold text-white/80">
                {t("game:noResponsesYet")}
              </span>
            )}
          </div>
        ) : (
          <div
            className={`mt-8 grid h-40 w-full max-w-3xl gap-4 px-2`}
            style={{ gridTemplateColumns: `repeat(${answers.length}, 1fr)` }}
          >
            {answers.map((_, key) => (
              <div
                key={key}
                className={clsx(
                  "flex flex-col justify-end self-end overflow-hidden rounded-md",
                  ANSWERS_COLORS[key],
                )}
                style={{ height: percentages[key] }}
              >
                <span className="w-full bg-black/10 text-center text-lg font-bold text-white drop-shadow-md">
                  {responses[key] || 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isWordCloud && (
        <div>
          <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 rounded-full px-2 text-lg font-bold text-white md:text-xl">
            {answers.map((answer, key) => (
              <AnswerButton
                key={key}
                className={clsx(ANSWERS_COLORS[key], {
                  // oxlint-disable-next-line typescript/no-unnecessary-condition
                  "opacity-65": responses && !solutions.includes(key),
                })}
                label={ANSWERS_LABELS[key]}
                correct={solutions.includes(key)}
              >
                {answer}
              </AnswerButton>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Responses
