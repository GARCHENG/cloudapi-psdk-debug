import { useCallback, useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import type { IClientOptions, MqttClient } from 'mqtt'

export type MqttStatus =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

interface UseMqttProps {
  brokerUrl: string
  options?: IClientOptions
  enabled: boolean
  onMessage?: (topic: string, message: string) => void
  onStatus?: (status: MqttStatus) => void
}

export const useMqtt = ({
  brokerUrl,
  options,
  enabled,
  onMessage,
  onStatus
}: UseMqttProps) => {
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<MqttStatus>('offline')
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<MqttClient | null>(null)

  const updateStatus = useCallback(
    (next: MqttStatus) => {
      setStatus(next)
      onStatus?.(next)
    },
    [onStatus]
  )

  useEffect(() => {
    if (!enabled) {
      if (clientRef.current) {
        clientRef.current.end(true)
        clientRef.current = null
      }
      setIsConnected(false)
      updateStatus('offline')
      return
    }

    if (!brokerUrl) {
      setIsConnected(false)
      setError('Missing broker URL')
      updateStatus('error')
      return
    }

    setError(null)
    updateStatus('connecting')

    const client = mqtt.connect(brokerUrl, options)
    clientRef.current = client

    client.on('connect', () => {
      setIsConnected(true)
      updateStatus('connected')
    })

    client.on('reconnect', () => {
      updateStatus('reconnecting')
    })

    client.on('offline', () => {
      setIsConnected(false)
      updateStatus('offline')
    })

    client.on('close', () => {
      setIsConnected(false)
      updateStatus('offline')
    })

    client.on('error', (err) => {
      setIsConnected(false)
      setError(err?.message ?? 'MQTT error')
      updateStatus('error')
    })

    client.on('message', (topic: string, message: Buffer) => {
      onMessage?.(topic, message.toString())
    })

    return () => {
      client.end(true)
      clientRef.current = null
    }
  }, [brokerUrl, enabled, onMessage, options, updateStatus])

  const subscribe = useCallback(
    (topic: string) => {
      if (!clientRef.current || !isConnected) return
      clientRef.current.subscribe(topic)
    },
    [isConnected]
  )

  const unsubscribe = useCallback((topic: string) => {
    clientRef.current?.unsubscribe(topic)
  }, [])

  const publish = useCallback(
    (topic: string, message: string) => {
      if (!clientRef.current || !isConnected) return
      clientRef.current.publish(topic, message)
    },
    [isConnected]
  )

  const connect = useCallback(() => {
    if (!clientRef.current) return
    clientRef.current.reconnect()
  }, [])

  const disconnect = useCallback(() => {
    if (!clientRef.current) return
    clientRef.current.end(true)
    clientRef.current = null
    setIsConnected(false)
    updateStatus('offline')
  }, [updateStatus])

  return {
    isConnected,
    status,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish
  }
}
