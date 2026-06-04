import { MEDIA_TYPES } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { ANSWERS_COLORS, ANSWERS_LABELS, SFX } from "@razzia/web/features/game/utils/constants"
import { useEffect } from "react"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SHOW_QUESTION"]
}

const Question = ({
  data: { question, media, cooldown, previewTimerDisabled, previewAnswers, answers },
}: Props) => {
  const [sfxShow] = useSound(SFX.SHOW_SOUND, { volume: 0.5 })

  useEffect(() => {
    sfxShow()
  }, [sfxShow])

  return (
    <section className="relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col items-center px-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <h2 className="anim-show text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        {media?.type === MEDIA_TYPES.IMAGE && (
          <img
            alt={question}
            src={media.url}
            className="max-h-60 w-auto rounded-md sm:max-h-100"
          />
        )}
      </div>
      {previewAnswers && answers ? (
        <div className="anim-show grid w-full max-w-5xl grid-cols-2 gap-4 rounded-2xl bg-gray-700 p-5 text-white md:grid-cols-4">
          {answers.map((answer, key) => (
            <div
              key={key}
              className={
                "button shadow-inset flex aspect-square h-full w-full items-center justify-center rounded-2xl px-2 text-center text-sm font-bold " +
                ANSWERS_COLORS[key]
              }
            >
              <div>
                <span className="text-2xl md:text-3xl">{ANSWERS_LABELS[key]}</span>
                <p className="mt-2 text-xs md:text-sm">{answer}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !previewTimerDisabled && (
          <div
            className="bg-primary mb-20 h-4 self-start justify-self-end rounded-full"
            style={{ animation: `progressBar ${cooldown}s linear forwards` }}
          ></div>
        )
      )}
    </section>
  )
}

export default Question
