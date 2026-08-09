// A press-and-hold touch/mouse button for on-screen game controls. Uses
// pointer events (not click) so movement starts on press and stops on
// release, matching keydown/keyup behavior — and onPointerLeave /
// onPointerCancel makes sure a finger dragging off the button (or an
// interrupted touch) doesn't leave a key stuck "held" forever.
export default function TouchButton({
  label,
  aria,
  onPress,
  onRelease,
  wide = false,
}) {
  return (
    <button
      aria-label={aria}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
      className={`${wide ? "w-14 h-14" : "w-12 h-12"} flex items-center justify-center text-lg rounded-full bg-neutral-800 border-2 border-neutral-600 text-neutral-100 active:bg-neutral-600 active:border-yellow-400`}
    >
      {label}
    </button>
  );
}
