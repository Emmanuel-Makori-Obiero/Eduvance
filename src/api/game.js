const BASE_URL = "http://127.0.0.1:8000";

// Expected shape of the resolved data (consumed by src/components/game.jsx):
//
// {
//   checkpoints: [
//     {
//       name: string,
//       position: { x: number, y: number },
//       speaker: string,
//       arrivalDialogue: string,
//       nextObjective: string | null,
//       challenge: {
//         type: "quiz",
//         question: string,
//         options: string[],
//         answer: number, // index into options
//       } | null,
//     },
//     ...
//   ],
//   enemies: [
//     {
//       name: string,
//       color: string,       // any valid canvas fillStyle
//       spawn: { x: number, y: number },
//       range: number,       // how far it patrols from spawn.x
//       after: number,       // checkpoint index it appears after (0 = from start)
//       intro: string,
//       victory: string,     // shown when defeated
//       questions: [
//         { q: string, options: string[], answer: number, rightFact: string, wrongFact: string },
//         ...
//       ],
//     },
//     ...
//   ],
// }

export async function generateGame(career, topic) {
  try {
    const response = await fetch(`${BASE_URL}/api/game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ career, topic }),
    });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error generating game:", error);
    return null;
  }
}
