import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [transportStatus, setTransportStatus] = useState<MqttStatus>('offline')
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<MqttClient | null>(null)

  const status = useMemo<MqttStatus>(() => {
    if (!enabled) return 'offline'
    if (!brokerUrl) return 'error'
    if (transportStatus === 'error') return 'error'
    if (transportStatus === 'reconnecting') return 'reconnecting'
    if (isConnected || transportStatus === 'connected') return 'connected'
    return 'connecting'
  }, [brokerUrl, enabled, isConnected, transportStatus])

  const resolvedError = useMemo(() => {
    if (!enabled) return null
    if (!brokerUrl) return 'Missing broker URL'
    return error
  }, [brokerUrl, enabled, error])

  useEffect(() => {
    onStatus?.(status)
  }, [onStatus, status])

  useEffect(() => {
    if (!enabled) {
      if (clientRef.current) {
        clientRef.current.end(true)
        clientRef.current = null
      }
      return
    }

    if (!brokerUrl) {
      return
    }

    const client = mqtt.connect(brokerUrl, options)
    clientRef.current = client

    client.on('connect', () => {
      setIsConnected(true)
      setError(null)
      setTransportStatus('connected')
    })

    client.on('reconnect', () => {
      setTransportStatus('reconnecting')
    })

    client.on('offline', () => {
      setIsConnected(false)
      setTransportStatus('offline')
    })

    client.on('close', () => {
      setIsConnected(false)
      setTransportStatus('offline')
    })

    client.on('error', (err) => {
      setIsConnected(false)
      setError(err?.message ?? 'MQTT error')
      setTransportStatus('error')
    })

    client.on('message', (topic: string, message: Buffer) => {
      onMessage?.(topic, message.toString())
    })

    return () => {
      client.end(true)
      clientRef.current = null
    }
  }, [brokerUrl, enabled, onMessage, options])

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
    setError(null)
    setTransportStatus('connecting')
    clientRef.current.reconnect()
  }, [])

  const disconnect = useCallback(() => {
    if (!clientRef.current) return
    clientRef.current.end(true)
    clientRef.current = null
    setIsConnected(false)
    setError(null)
    setTransportStatus('offline')
  }, [])

  return {
    isConnected,
    status,
    error: resolvedError,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish
  }
}
