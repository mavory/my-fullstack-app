import { useEffect, useState } from "react";

export default function NotFound() {
  const [particles] = useState(
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      size: Math.floor(Math.random() * 20) + 10,
      blur: (i + 1) * 0.02,
      top: Math.random() * 100,
      left: Math.random() * 100,
      anim: ["float", "floatReverse", "float2", "floatReverse2"][
        Math.floor(Math.random() * 4)
      ],
      speed: Math.floor(Math.random() * 20) + 20,
      delay: Math.random() * 1,
    }))
  );

  return (
    <main className="relative flex items-center justify-center h-screen bg-white overflow-hidden font-sans">
      {/* Particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute text-gray-600 select-none pointer-events-none"
          style={{
            fontSize: `${p.size}px`,
            filter: `blur(${p.blur}px)`,
            top: `${p.top}%`,
            left: `${p.left}%`,
            animation: `${p.anim} ${p.speed}s infinite`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.id % 2 === 0 ? "4" : "0"}
        </span>
      ))}

      {/* Content box */}
      <article className="relative w-full max-w-xl bg-white px-8 py-12 text-center shadow-lg opacity-0 animate-[apparition_0.8s_1.2s_forwards]">
        <p className="text-xl tracking-wider text-gray-600">
          Damn...
        </p>
        <p className="text-xl tracking-wider text-gray-600">
          Ztratil ses v <strong className="font-bold">404</strong> galaxy.
        </p>
        <p>
          <button
            onClick={() => (window.location.href = "/")}
            className="mt-8 px-4 py-2 border-2 border-gray-600 text-gray-600 font-bold hover:bg-gray-100 transition"
          >
            Vrátit se zpátky na zem
          </button>
        </p>
      </article>

      {/* Animations */}
      <style>{`
        @keyframes apparition {
          from { opacity: 0; transform: translateY(100px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(180px); }
        }
        @keyframes floatReverse {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-180px); }
        }
        @keyframes float2 {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(28px); }
        }
        @keyframes floatReverse2 {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-28px); }
        }
      `}</style>
    </main>
  );
}
