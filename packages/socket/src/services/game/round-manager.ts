// oxlint-disable typescript/no-unnecessary-condition
import { EVENTS, MEDIA_TYPES, QUESTION_TYPES } from "@razzia/common/constants"
import type {
    Answer,
    GameResult,
    Player,
    Question,
    QuestionResult,
    Quizz,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
    type Status,
    STATUS,
    type StatusDataMap,
} from "@razzia/common/types/game/status"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { timeToPoint } from "@razzia/socket/utils/game"
import sleep from "@razzia/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

export interface RoundManagerOptions {
  quizz: Quizz
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
}

const getQuestionType = (question: Question) =>
  question.type ?? QUESTION_TYPES.MULTIPLE_CHOICE

const normalizeWordCloudAnswer = (answer: string) =>
  answer.trim().replace(/\s+/gu, " ").toLowerCase()

const getWordCloudOptions = (question: Question) => ({
  allowMultipleAnswers: question.wordCloud?.allowMultipleAnswers ?? false,
  showLiveResponses: question.wordCloud?.showLiveResponses ?? false,
})

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  private startTime = 0
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []
  private manualAdvanceResolver: (() => void) | null = null
  private manualShowQuestionResolver: (() => void) | null = null

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
  }

  isStarted(): boolean {
    return this.started
  }

  private waitForManualAdvance(): Promise<void> {
    return new Promise((resolve) => {
      this.manualAdvanceResolver = () => {
        this.manualAdvanceResolver = null
        resolve()
      }
    })
  }

  private waitForManualShowQuestion(): Promise<void> {
    return new Promise((resolve) => {
      this.manualShowQuestionResolver = () => {
        this.manualShowQuestionResolver = null
        resolve()
      }
    })
  }

  private triggerManualAdvance(): void {
    if (!this.manualAdvanceResolver) {
      return
    }

    this.manualAdvanceResolver()
  }

  private triggerManualShowQuestion(): void {
    if (!this.manualShowQuestionResolver) {
      return
    }

    this.manualShowQuestionResolver()
  }

  private getAggregatedResponses(question: Question): Record<string, number> {
    const questionType = getQuestionType(question)

    return this.playersAnswers.reduce(
      (acc: Record<string, number>, { answerId, answerText }) => {
        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
          if (!answerText) {
            return acc
          }

          acc[answerText] = (acc[answerText] || 0) + 1

          return acc
        }

        if (answerId === null) {
          return acc
        }

        const key = String(answerId)
        acc[key] = (acc[key] || 0) + 1

        return acc
      },
      {},
    )
  }

  private countAnsweredPlayers(question: Question): number {
    if (getQuestionType(question) !== QUESTION_TYPES.WORD_CLOUD) {
      return this.playersAnswers.length
    }

    const answeredPlayers = new Set(
      this.playersAnswers
        .filter((answer) => Boolean(answer.answerText))
        .map((answer) => answer.playerId),
    )

    return answeredPlayers.size
  }

  private sendManagerResponses(question: Question, finalized: boolean): void {
    const questionType = getQuestionType(question)

    if (questionType === QUESTION_TYPES.NUMERIC) {
      const numericResponses = this.playersAnswers
        .filter((a) => typeof a.numericValue === "number")
        .map((a) => ({
          value: a.numericValue as number,
          playerName: this.opts.players.findById(a.playerId)?.username ?? "Unknown",
        }))

      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
        ...question,
        questionType,
        responses: {},
        numericResponses,
        numericSolution: question.numericSolution,
        finalized,
      })

      return
    }

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...question,
      questionType,
      responses: this.getAggregatedResponses(question),
      finalized,
    })
  }

  getReconnectInfo() {
    return {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    }
  }

  async start(socket: Socket): Promise<void> {
    if (this.opts.getManagerId() !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.started = true

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    void this.newQuestion()
  }

  async newQuestion(): Promise<void> {
    if (!this.started) {
      return
    }

    const question = this.opts.quizz.questions[this.currentQuestion]
    const questionType = getQuestionType(question)
    const wordCloudOptions = getWordCloudOptions(question)
    const previewTimerDisabled =
      question.disablePreviewTimer ?? question.disableTimers ?? false
    const previewAnswers = question.previewAnswers ?? false
    const answerTimerDisabled =
      question.disableAnswerTimer ?? question.disableTimers ?? false

    this.opts.onNewQuestion()

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
      current: this.currentQuestion + 1,
      total: this.opts.quizz.questions.length,
    })

    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers:
        questionType === QUESTION_TYPES.WORD_CLOUD
          ? 0
          : question.answers.length,
      questionNumber: this.currentQuestion + 1,
      questionType,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    const imageMedia =
      question.media?.type === MEDIA_TYPES.IMAGE ? question.media : undefined

    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: question.question,
      media: imageMedia,
      cooldown: question.cooldown,
      previewTimerDisabled: previewTimerDisabled || previewAnswers,
      previewAnswers,
      answers: previewAnswers ? question.answers : undefined,
    })

    if (previewTimerDisabled || previewAnswers) {
      await this.waitForManualShowQuestion()
    } else {
      await sleep(question.cooldown)
    }

    if (!this.started) {
      return
    }

    this.startTime = Date.now()

    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      questionType,
      wordCloudAllowMultipleAnswers: wordCloudOptions.allowMultipleAnswers,
      wordCloudShowLiveResponses: wordCloudOptions.showLiveResponses,
      answerTimerDisabled,
      question: question.question,
      answers: question.answers,
      media: question.media,
      time: question.time,
      totalPlayer: this.opts.players.count(),
    })

    if (
      questionType === QUESTION_TYPES.WORD_CLOUD &&
      wordCloudOptions.showLiveResponses
    ) {
      this.sendManagerResponses(question, false)
    }

    if (answerTimerDisabled) {
      await this.waitForManualAdvance()
    } else {
      await this.opts.cooldown.start(question.time)
    }

    if (!this.started) {
      return
    }

    this.showResults(question)
  }

  private showResults(question: Question): void {
    const questionType = getQuestionType(question)
    const currentPlayers = this.opts.players.getAll()

    let numericMin = 0
    let numericMax = 0
    let numericExists = false

    if (questionType === QUESTION_TYPES.NUMERIC) {
      const numericResponses = this.playersAnswers
        .map((a) => a.numericValue)
        .filter((v): v is number => typeof v === "number")

      if (numericResponses.length > 0) {
        numericMin = Math.min(...numericResponses)
        numericMax = Math.max(...numericResponses)
        numericExists = true
      }
    }

    // determine closest numeric responder(s) (for awarding a "correct" screen)
    let closestPlayerIds: string[] = []
    if (
      questionType === QUESTION_TYPES.NUMERIC &&
      numericExists &&
      typeof question.numericSolution === "number"
    ) {
      const sol = question.numericSolution
      const distances = this.playersAnswers
        .map((a) => ({ id: a.playerId, v: a.numericValue }))
        .filter((p): p is { id: string; v: number } => typeof p.v === "number")
        .map((p) => ({ id: p.id, dist: Math.abs(p.v - sol) }))

      if (distances.length > 0) {
        distances.sort((a, b) => a.dist - b.dist)
        const minDist = distances[0].dist
        // all players at the minimal distance are considered correct (allow ties)
        closestPlayerIds = distances.filter((d) => d.dist === minDist).map((d) => d.id)
      }
    }

    const oldLeaderboard = (() => {
      if (this.leaderboard.length === 0) {
        return currentPlayers.map((p) => ({ ...p }))
      }

      return this.leaderboard.map((p) => ({ ...p }))
    })()

    const sortedPlayers = currentPlayers
      .map((player) => {
        const playerAnswers = this.playersAnswers.filter(
          (a) => a.playerId === player.id,
        )
        const [playerAnswer] = playerAnswers

        let hasAnswered = false

        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
          hasAnswered = playerAnswers.some((answer) =>
            Boolean(answer.answerText),
          )
        } else if (questionType === QUESTION_TYPES.NUMERIC) {
          hasAnswered = Boolean(playerAnswer && typeof playerAnswer.numericValue === "number")
        } else if (playerAnswer) {
          hasAnswered = playerAnswer.answerId !== null
        }

        let isCorrect = false

        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
          isCorrect = hasAnswered
        } else if (questionType === QUESTION_TYPES.NUMERIC) {
          isCorrect =
              typeof question.numericSolution === "number" &&
              playerAnswer &&
              typeof playerAnswer.numericValue === "number" &&
              (
                playerAnswer.numericValue === question.numericSolution ||
                closestPlayerIds.includes(player.id)
              )
        } else if (playerAnswer && playerAnswer.answerId !== null) {
          isCorrect = question.solutions.includes(playerAnswer.answerId)
        }

        let points = 0

        if (questionType === QUESTION_TYPES.NUMERIC && playerAnswer && typeof playerAnswer.numericValue === "number" && typeof question.numericSolution === "number") {
          const base = Math.round(playerAnswer.points)
          const min = numericExists ? numericMin : question.numericSolution
          const max = numericExists ? numericMax : question.numericSolution
          const maxDiff = Math.max(Math.abs(question.numericSolution - min), Math.abs(question.numericSolution - max), 1)
          const d = Math.abs(playerAnswer.numericValue - question.numericSolution)
          const proximity = Math.max(0, 1 - d / maxDiff)

          points = Math.round(base * proximity)
        } else if (
          questionType !== QUESTION_TYPES.WORD_CLOUD &&
          playerAnswer &&
          isCorrect
        ) {
          points = Math.round(playerAnswer.points)
        }

        player.points += points

        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
          player.streak = 0
        } else if (isCorrect) {
          player.streak += 1
        } else {
          player.streak = 0
        }

        return { ...player, lastCorrect: isCorrect, lastPoints: points }
      })
      .sort((a, b) => b.points - a.points)

    this.opts.players.replace(sortedPlayers)

    sortedPlayers.forEach((player, index) => {
      const rank = index + 1
      const aheadPlayer = sortedPlayers[index - 1]

      let message = "game:wrong"

      if (questionType === QUESTION_TYPES.WORD_CLOUD) {
        message = player.lastCorrect
          ? "game:answerReceived"
          : "game:noAnswerReceived"
      } else if (player.lastCorrect) {
        message = "game:correct"
      }

      this.opts.send(player.id, STATUS.SHOW_RESULT, {
        correct: player.lastCorrect,
        message,
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    this.sendManagerResponses(question, true)

    this.questionsHistory.push({
      ...question,
      playerAnswers: currentPlayers.map((player) => {
        const playerAnswers = this.playersAnswers.filter(
          (a) => a.playerId === player.id,
        )

        if (questionType === QUESTION_TYPES.WORD_CLOUD) {
          const answerTexts = playerAnswers
            .map((answer) => answer.answerText)
            .filter((answer): answer is string => Boolean(answer))
          const uniqueTexts = Array.from(new Set(answerTexts))

          return {
            playerName: player.username,
            answerId: null,
            answerText:
              uniqueTexts.length > 0 ? uniqueTexts.join(", ") : undefined,
          }
        }

        const [playerAnswer] = playerAnswers

        if (questionType === QUESTION_TYPES.NUMERIC) {
          return {
            playerName: player.username,
            answerId: null,
            answerText:
              typeof playerAnswer?.numericValue === "number"
                ? String(playerAnswer?.numericValue)
                : undefined,
          }
        }

        return {
          playerName: player.username,
          answerId: playerAnswer?.answerId ?? null,
          answerText: undefined,
        }
      }),
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard
    this.playersAnswers = []
  }

  selectAnswer(
    socket: Socket,
    answer: { answerKey?: number; answerText?: string },
  ): void {
    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]
    const questionType = getQuestionType(question)
    const wordCloudOptions = getWordCloudOptions(question)

    if (!player) {
      return
    }

    if (questionType === QUESTION_TYPES.WORD_CLOUD) {
      const answerText = answer.answerText
        ? normalizeWordCloudAnswer(answer.answerText)
        : undefined

      if (!answerText) {
        return
      }

      const playerAnswers = this.playersAnswers.filter(
        (entry) => entry.playerId === socket.id,
      )

      if (!wordCloudOptions.allowMultipleAnswers && playerAnswers.length > 0) {
        return
      }

      if (
        wordCloudOptions.allowMultipleAnswers &&
        playerAnswers.some((entry) => entry.answerText === answerText)
      ) {
        return
      }

      this.playersAnswers.push({
        playerId: player.id,
        answerId: null,
        answerText,
        points: 0,
      })

      if (wordCloudOptions.showLiveResponses) {
        this.sendManagerResponses(question, false)
      }

      if (!wordCloudOptions.allowMultipleAnswers) {
        this.opts.send(socket.id, STATUS.WAIT, {
          text: "game:waitingForAnswers",
        })
      }
    } else if (questionType === QUESTION_TYPES.NUMERIC) {
      if (this.playersAnswers.find((entry) => entry.playerId === socket.id)) {
        return
      }

      const raw = answer.answerText

      if (!raw) {
        return
      }

      const value = Number(raw)

      if (!Number.isFinite(value) || value < 0) {
        return
      }

      // store numeric value and base points (time-based)
      this.playersAnswers.push({
        playerId: player.id,
        answerId: null,
        numericValue: value,
        points: timeToPoint(this.startTime, question.time),
      })

      this.opts.send(socket.id, STATUS.WAIT, {
        text: "game:waitingForAnswers",
      })
    } else {
      if (this.playersAnswers.find((entry) => entry.playerId === socket.id)) {
        return
      }

      const answerId = answer.answerKey

      if (
        !Number.isInteger(answerId) ||
        answerId === undefined ||
        !question.answers[answerId]
      ) {
        return
      }

      this.playersAnswers.push({
        playerId: player.id,
        answerId,
        points: timeToPoint(this.startTime, question.time),
      })

      this.opts.send(socket.id, STATUS.WAIT, {
        text: "game:waitingForAnswers",
      })
    }

    const playerAnswerCount =
      questionType === QUESTION_TYPES.WORD_CLOUD &&
      wordCloudOptions.allowMultipleAnswers
        ? this.playersAnswers.length
        : this.countAnsweredPlayers(question)

    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, playerAnswerCount)
    this.opts.players.broadcastCount()

    if (
      questionType === QUESTION_TYPES.WORD_CLOUD &&
      wordCloudOptions.allowMultipleAnswers
    ) {
      return
    }

    if (this.countAnsweredPlayers(question) === this.opts.players.count()) {
      this.opts.cooldown.abort()
      this.triggerManualAdvance()
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    if (!this.opts.quizz.questions[this.currentQuestion + 1]) {
      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  showQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.triggerManualShowQuestion()
  }

  abortQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
    this.triggerManualAdvance()
  }

  showLeaderboard(): void {
    const isLastRound =
      this.currentQuestion + 1 === this.opts.quizz.questions.length

    if (isLastRound) {
      this.started = false

      const top = this.leaderboard.slice(0, 3)

      this.opts.onGameFinished({
        id: `${Date.now()}-${nanoid(8)}`,
        subject: this.opts.quizz.subject,
        date: new Date().toISOString(),
        players: this.leaderboard.map((player, index) => ({
          username: player.username,
          points: player.points,
          rank: index + 1,
        })),
        questions: this.questionsHistory,
      })

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: index + 1,
        })
      })

      return
    }

    const oldLeaderboard = this.tempOldLeaderboard ?? this.leaderboard

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: oldLeaderboard.slice(0, 5),
      leaderboard: this.leaderboard.slice(0, 5),
    })

    this.tempOldLeaderboard = null
  }
}
