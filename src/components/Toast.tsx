interface Props {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: Props) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 text-white text-sm rounded-2xl flex items-center gap-2 transition-all duration-300 font-medium border ${
        visible ? 'opacity-100 translate-y-0 shadow-2xl' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <span className="text-green-400">✓</span>
      <span dir="rtl">{message}</span>
    </div>
  );
}
