import MainLayoutWithChat from '@/components/MainLayoutWithChat'

export default function WithChatLayout({ children }) {
  return (
    <MainLayoutWithChat>
      {children}
    </MainLayoutWithChat>
  )
}
