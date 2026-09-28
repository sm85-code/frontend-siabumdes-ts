import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function DefaultFallback({ context }: { context?: string }) {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Terjadi kesalahan tak terduga</CardTitle>
          <CardDescription>
            Halaman ini mengalami masalah{context ? ` (${context})` : ''} dan tidak dapat
            ditampilkan sebagaimana mestinya. Silakan muat ulang halaman atau kembali ke dasbor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CardFooter className="flex gap-2 p-0">
            <Button onClick={() => window.location.reload()}>Muat Ulang</Button>
            <Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
              Kembali ke Dashboard
            </Button>
          </CardFooter>
        </CardContent>
      </Card>
    </div>
  )
}

interface Props {
  children: ReactNode
  context?: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.context ? `:${this.props.context}` : ''}] Uncaught render error:`,
      error,
      errorInfo,
    )
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return <DefaultFallback context={this.props.context} />
    }
    return this.props.children
  }
}
