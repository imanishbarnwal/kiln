'use client'
import { Chessboard } from 'react-chessboard'

export function ChessBoardInline({ fen }: { fen: string }) {
  return (
    <div className="max-w-[280px] mt-2">
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          showNotation: true,
        }}
      />
    </div>
  )
}
