import {
  getPlayModeLabel,
  getSystemStateLabel,
  getWorkModeLabel
} from '../types/psdk'

export const buildEventsTopic = (gatewaySn: string) =>
  `thing/product/${gatewaySn}/events`

export const buildServicesTopic = (gatewaySn: string) =>
  `thing/product/${gatewaySn}/services`

export const buildServicesReplyTopic = (gatewaySn: string) =>
  `thing/product/${gatewaySn}/services_reply`

export const buildStateTopic = (deviceSn: string) =>
  `thing/product/${deviceSn}/state`

export { getPlayModeLabel, getSystemStateLabel, getWorkModeLabel }
