import { Button } from '@/components/ui/primitives';
import { Link } from '@tanstack/react-router';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="label-micro mb-4">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-white">That page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        The link may be broken, or the page moved. Everything important lives in the sidebar.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="primary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
