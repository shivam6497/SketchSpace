export const SOCKET_EVENTS = {

  JOIN_ROOM:        'join-room',
  LEAVE_ROOM:       'leave-room',
  YJS_UPDATE:       'yjs-update',
  AWARENESS_UPDATE: 'awareness-update',
  CURSOR_MOVE:      'cursor-move',

  ROOM_STATE:       'room-state',      
  YJS_BROADCAST:    'yjs-broadcast',    
  AWARENESS_BROADCAST: 'awareness-broadcast',
  USER_JOINED:      'user-joined',
  USER_LEFT:        'user-left',
  ERROR:            'error',
} as const

export type SocketEvents = typeof SOCKET_EVENTS

export interface JoinRoomPayload {
  roomId: string
}

export interface YjsUpdatePayload {
  roomId: string
  update: ArrayBuffer   
}

export interface AwarenessUpdatePayload {
  roomId: string
  update: ArrayBuffer
}

export interface YjsBroadcastPayload {
  roomId: string
  update: ArrayBuffer
}

export interface CursorMovePayload {
  roomId: string
  x: number
  y: number
}

export interface RoomStatePayload {
  roomId:   string
  update:   ArrayBuffer 
  members:  ActiveMember[]
}

export interface ActiveMember {
  userId:      string
  displayName: string
  avatarUrl:   string | null
  color:       string    
}

export interface UserJoinedPayload {
  roomId: string
  member: ActiveMember
}

export interface UserLeftPayload {
  roomId:  string
  userId:  string
}

export interface SocketError {
  code:    string
  message: string
}