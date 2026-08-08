export default function Spinner() {
  return (
    <div className="flex items-center gap-3 text-muted dark:text-muted-dark text-sm py-2">
      <span
        className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
        style={{
          borderColor: "var(--color-marker-1)",
          borderTopColor: "transparent",
        }}
      ></span>
      <span className="font-mono text-xs">
        Working through it — this can take a minute.
      </span>
    </div>
  );
}
