export default function QuietPet({
  breathing = true,
}: {
  breathing?: boolean;
}) {
  return (
    <svg
      className={`quiet-pet ${breathing ? "is-breathing" : ""}`}
      viewBox="0 0 180 145"
      role="img"
      aria-label="安静陪伴的小兔子"
    >
      <ellipse cx="90" cy="135" rx="54" ry="5" fill="#eae4d5" />
      <g className="pet-body">
        <path
          d="M56 61C38 17 46 7 58 12c11 5 15 22 18 43M102 55c3-34 8-46 20-43 15 4 13 24-1 53"
          fill="#e8d5b6"
          stroke="#bba583"
          strokeWidth="2"
        />
        <path
          d="M59 46c-6-15-8-23-4-25m58 24c4-13 7-22 6-25"
          stroke="#d1ae96"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M47 109c-3-26 4-59 40-61 35-2 49 22 47 53 14 15 7 31-13 31H62c-20 0-26-12-15-23"
          fill="#efdfc3"
          stroke="#bba583"
          strokeWidth="2"
        />
        <ellipse cx="89" cy="115" rx="24" ry="17" fill="#f8edd8" />
        <ellipse cx="65" cy="85" rx="4" ry="5" fill="#4f4a3d" />
        <ellipse cx="112" cy="85" rx="4" ry="5" fill="#4f4a3d" />
        <circle cx="66" cy="84" r="1.1" fill="#fff" />
        <circle cx="113" cy="84" r="1.1" fill="#fff" />
        <ellipse cx="58" cy="96" rx="7" ry="4" fill="#dfb8a2" opacity=".7" />
        <ellipse cx="121" cy="96" rx="7" ry="4" fill="#dfb8a2" opacity=".7" />
        <path
          d="m85 93 4 3 4-3m-4 3v4m-6 0c3 3 9 3 12 0"
          stroke="#8c7764"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M59 126h12m37 0h12"
          stroke="#c8b392"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
