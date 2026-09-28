import Button from '@/components/ui/Button'

export default function LoadMoreButton({ onClick, loading }) {
  return (
    <div className="flex justify-center mt-4">
      <Button variant="outline" size="sm" onClick={onClick} loading={loading}>
        Carregar mais
      </Button>
    </div>
  )
}
