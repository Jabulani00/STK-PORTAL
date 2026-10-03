import { Card, CardBody } from './ui/card.tsx'

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
        {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      </CardBody>
    </Card>
  )
}
