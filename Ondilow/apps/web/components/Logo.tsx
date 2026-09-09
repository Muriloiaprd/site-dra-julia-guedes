export function Logo({ size = 32 }: { size?: number }) {
  // Placeholder de marca ate as imagens finais do usuario chegarem.
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2f81f7" />
        <path
          d="M6 22 L13 10 L19 20 L26 8"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight">Ondilow</span>
    </div>
  );
}
