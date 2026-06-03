import { EVENTS } from "@razzia/common/constants"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import PinInput from "@razzia/web/components/PinInput"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useSearch } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const Room = () => {
  const { socket, isConnected } = useSocket()
  const { join } = usePlayerStore()
  const [invitation, setInvitation] = useState("")
  const { pin, gameId } = useSearch({ from: "/(auth)/" })
  const hasJoinedRef = useRef(false)
  const { t } = useTranslation()

  const handleJoin = () => {
    socket.emit(EVENTS.PLAYER.JOIN, invitation.replace(/\s/gu, ""))
  }

  useEvent(EVENTS.GAME.SUCCESS_ROOM, (joinedGameId) => {
    join(joinedGameId)
  })

  useEffect(() => {
    if (!isConnected || hasJoinedRef.current) {
      return
    }

    if (gameId) {
      socket.emit(EVENTS.PLAYER.JOIN_GAME_ID, gameId)
      hasJoinedRef.current = true

      return
    }

    if (!pin) {
      return
    }

    socket.emit(EVENTS.PLAYER.JOIN, pin)
    hasJoinedRef.current = true
  }, [gameId, pin, isConnected, socket])

  return (
    <Card>
      <p className="mb-2 text-lg font-semibold">{t("game:pinLabel")}</p>
      <PinInput value={invitation} onChange={setInvitation} />
      <Button className="mt-4" onClick={handleJoin}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Room
