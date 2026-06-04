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
  data,
}: Props) => {
  const {
    question,
    answers,
    responses,
    solutions,
    questionType,
    finalized,
    numericResponses,
    numericSolution,
  } = data
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const isWordCloud = questionType === QUESTION_TYPES.WORD_CLOUD
  const isNumeric = questionType === QUESTION_TYPES.NUMERIC
  const { t } = useTranslation()

  const wordResponses = useMemo(
    () =>
      Object.entries(responses)
        .slice(0, 25),
    [responses],
  )

  const maxWordCount = useMemo(
    () => Math.max(1, ...wordResponses.map(([, count]) => count)),
    [wordResponses],
  )

  const fontSizeScale = useMemo(() => {
    const wordCount = wordResponses.length
    if (wordCount <= 8) return 1.0
    if (wordCount <= 15) return 0.85
    if (wordCount <= 20) return 0.7
    return Math.max(0.5, 1.0 - (wordCount - 20) * 0.02)
  }, [wordResponses.length])

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
          <div className="mt-6 flex max-w-7xl flex-wrap items-center justify-center gap-3 rounded-xl bg-black/25 p-5">
            {wordResponses.length > 0 ? (
              wordResponses.map(([word, count]) => {
                const weight = Math.log(count + 1) / Math.log(maxWordCount + 1)
                const baseFontSize = 14 + weight * 52
                const fontSize = `${Math.round(baseFontSize * fontSizeScale)}px`
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
        ) : isNumeric ? (
          <div className="mt-6 flex w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-xl p-6">
            {(!numericResponses || numericResponses.length === 0) ? (
              <span className="text-xl font-semibold text-white/80">{t("game:noResponsesYet")}</span>
            ) : (
              (() => {
                const values = numericResponses || []
                const hasSolution = typeof numericSolution === "number"
                const minValue = Math.min(
                  ...values.map((v) => v.value),
                  ...(hasSolution ? [numericSolution] : []),
                )
                const maxValue = Math.max(
                  ...values.map((v) => v.value),
                  ...(hasSolution ? [numericSolution] : []),
                )
                const range = Math.max(maxValue - minValue, 1)
                const positions = values.map((response, index) => {
                  const pos = ((response.value - minValue) / range) * 100
                  return { index, value: response.value, playerName: response.playerName, pos }
                })

                const labelThreshold = 6
                const visibleLabels = positions
                  .slice()
                  .sort((a, b) => a.pos - b.pos)
                  .reduce<{ pos: number; value: number; playerName: string; index: number }[]>(
                    (acc, point) => {
                      const previous = acc[acc.length - 1]
                      if (!previous || Math.abs(point.pos - previous.pos) >= labelThreshold) {
                        acc.push(point)
                      }
                      return acc
                    },
                    [],
                  )
                const visibleLabelIndexes = new Set(
                  visibleLabels.map((item) => item.index),
                )

                return (
                  <div className="w-full">
                    <div className="relative mx-auto mb-3 h-40 w-full max-w-3xl">
                      {/* white baseline for answers */}
                      <div className="absolute left-0 right-0 top-1/2 h-2 rounded-full bg-white" />

                      {/* prepare deduped player positions so overlapping triangles collapse */}
                      {(() => {
                        const dedupThreshold = 2 // percent distance to consider overlapping
                        const sorted = positions.slice().sort((a, b) => a.pos - b.pos)
                        const deduped = sorted.reduce<typeof positions>((acc, p) => {
                          const prev = acc[acc.length - 1]
                          if (!prev || Math.abs(p.pos - prev.pos) >= dedupThreshold) {
                            acc.push(p)
                          }
                          return acc
                        }, [])

                        return (
                          <>
                            {deduped.map(({ value, playerName, pos }, i) => (
                              <div
                                key={`player-${i}-${value}`}
                                className="absolute flex flex-col items-center"
                                style={{ left: `${pos}%`, top: `calc(50% - 4.5rem)`, transform: 'translateX(-50%)' }}
                              >
                                <div className="mb-1 text-sm font-semibold text-white/80">
                                  {playerName}
                                </div>
                                <div className="mb-1 text-xl font-semibold text-white">
                                  {value}
                                </div>
                                <svg width="36" height="20" viewBox="0 0 36 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <polygon points="18,20 0,0 36,0" fill="#ffffff" />
                                </svg>
                              </div>
                            ))}
                          </>
                        )
                      })()}

                      {hasSolution && (() => {
                        const solPos = ((numericSolution - minValue) / range) * 100

                        return (
                          <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${solPos}%`, top: `calc(50% + 0.5rem)`, transform: 'translateX(-50%)' }}
                          >
                            <svg width="40" height="22" viewBox="0 0 40 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <polygon points="20,0 0,22 40,22" fill="#f43f5e" />
                            </svg>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {numericSolution}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })()
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

      {!isWordCloud && !isNumeric && (
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
