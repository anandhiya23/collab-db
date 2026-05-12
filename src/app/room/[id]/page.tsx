import { RoomEditor } from '@/components/RoomEditor'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoomEditor roomId={id} />
}
