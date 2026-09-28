import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Placeholder until F1+ ports the real page. */
export default function StubPage({ title, note }: { title: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {note ?? 'Halaman ini masih stub (F0 scaffold). Port penuh di F1+.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Perilaku & menu sama dengan live FE; konten halaman belum dipindahkan.
        </p>
      </CardContent>
    </Card>
  )
}
