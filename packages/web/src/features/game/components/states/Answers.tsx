import { EVENTS, MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type { QuestionMediaType } from "@razzia/common/types/game"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import AnswerButton from "@razzia/web/features/game/components/AnswerButton"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import {
  ANSWERS_COLORS,
  ANSWERS_LABELS,
  SFX,
} from "@razzia/web/features/game/utils/constants"
import clsx from "clsx"
import { type KeyboardEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import useSound from "use-sound"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: {
    question,
    answers,
    media,
    time,
    totalPlayer,
    questionType,
    wordCloudAllowMultipleAnswers,
    timersDisabled,
  },
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [wordAnswer, setWordAnswer] = useState("")
  const { t } = useTranslation()
  const isWordCloud = questionType === QUESTION_TYPES.WORD_CLOUD
  const isMultiWordCloud = isWordCloud && Boolean(wordCloudAllowMultipleAnswers)

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX.ANSWERS.MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const handleAnswer = (answerKey: number) => () => {
    if (!player || !gameId) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKey,
      },
    })
    sfxPop()
  }

  const handleWordCloudSubmit = () => {
    if (!player || !gameId) {
      return
    }

    const trimmed = wordAnswer.trim()

    if (!trimmed) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerText: trimmed,
      },
    })

    setWordAnswer("")
    sfxPop()
  }

  const handleWordCloudKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleWordCloudSubmit()
    }
  }

  useEffect(() => {
    const disabledMusicMedia = [
      MEDIA_TYPES.AUDIO,
      MEDIA_TYPES.VIDEO,
    ] as QuestionMediaType[]

    if (disabledMusicMedia.includes(media?.type)) {
      return
    }

    playMusic()

    return () => {
      stopMusic()
    }
    // oxlint-disable-next-line
  }, [playMusic])

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        <QuestionMedia media={media} alt={question} />
      </div>

      <div>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          {!timersDisabled && (
            <div className="flex flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
              <span className="translate-y-1 text-sm">
                {t("game:hud.time")}
              </span>
              <span>{cooldown}</span>
            </div>
          )}
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">
              {t(
                isMultiWordCloud ? "game:hud.submissions" : "game:hud.answers",
              )}
            </span>
            <span>
              {isMultiWordCloud ? totalAnswer : `${totalAnswer}/${totalPlayer}`}
            </span>
          </div>
        </div>

        {isWordCloud ? (
          <div className="mx-auto mb-4 flex w-full max-w-3xl gap-2 px-2">
            <Input
              className="flex-1 border border-white/30 bg-white/95 text-center"
              value={wordAnswer}
              maxLength={40}
              placeholder={t("game:wordCloudPlaceholder")}
              onChange={(event) => setWordAnswer(event.target.value)}
              onKeyDown={handleWordCloudKeyDown}
            />
            <Button className="px-5" onClick={handleWordCloudSubmit}>
              {t("game:wordCloudSubmit")}
            </Button>
          </div>
        ) : (
          <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 px-2 text-lg font-bold text-white md:text-xl">
            {answers.map((answer, key) => (
              <AnswerButton
                key={key}
                className={clsx(ANSWERS_COLORS[key])}
                label={ANSWERS_LABELS[key]}
                onClick={handleAnswer(key)}
              >
                {answer}
              </AnswerButton>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Answers
