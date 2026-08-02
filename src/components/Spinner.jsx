export default function Spinner() {
  return (
    <div className="flex items-center gap-3 text-muted dark:text-muted-dark text-sm py-2">
      <span className="w-3 h-3 border border-ink dark:border-ink-dark border-t-transparent rounded-full animate-spin"></span>
      Working through it — this can take a minute.
    </div>
  );
}
