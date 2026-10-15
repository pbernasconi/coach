extension ExerciseGuide {
    /// Back squat, front squat, goblet squat, leg press.
    static let squats: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 1,
            setup: [
                "Set the bar in the rack at mid-chest height and the safety arms just below your squat depth.",
                "Step under the bar and rest it on your upper back, below the bony top of the shoulders. Grip it evenly, a little wider than your shoulders.",
                "Stand up to unrack, take two or three short steps back, and set your feet about shoulder-width apart with the toes turned out slightly.",
            ],
            steps: [
                "Brace your midsection, chest up, eyes on the floor a few metres ahead.",
                "Start down by bending at the hips and knees at the same time.",
                "Let your knees travel forward and out over your toes as you sit down between your heels.",
                "Lower until your hip crease is level with or just below the top of your knees, or as deep as you can keep your back flat.",
                "Drive up through your whole foot, keeping the bar over the middle of your foot.",
                "Stand fully upright and reset your brace before the next rep.",
            ],
            cues: ["Bar over mid-foot", "Knees follow the toes", "Chest and hips rise together"],
            mistakes: [
                "Knees caving inward on the way up.",
                "Heels lifting, or the weight shifting onto the toes.",
                "Hips shooting up first so the squat turns into a good morning.",
                "Losing the brace and rounding the lower back at the bottom.",
            ],
            breathing:
                "Take a big breath and brace before each descent. Hold it through the bottom and breathe out near the top.",
            videoQuery: "back squat technique"
        ),
        ExerciseGuide(
            seed: 2,
            setup: [
                "Set the bar in the rack at upper-chest height.",
                "Step in so the bar rests on the front of your shoulders, close to your throat. Hold it with fingertips under the bar and elbows high, or with your arms crossed.",
                "Unrack, step back, and set your feet about shoulder-width apart with the toes turned out slightly.",
            ],
            steps: [
                "Lift your elbows until your upper arms are close to parallel with the floor.",
                "Brace and sit straight down, keeping your torso upright.",
                "Let your knees move well forward over your toes.",
                "Lower until your thighs are at least parallel to the floor.",
                "Drive up through your whole foot, leading with your elbows.",
                "Stand fully upright before the next rep.",
            ],
            cues: ["Elbows high", "Sit straight down", "Stay tall"],
            mistakes: [
                "Elbows dropping so the bar rolls forward off the shoulders.",
                "Leaning forward as you stand up.",
                "Holding the bar up with the hands instead of resting it on the shoulders.",
            ],
            breathing: "Breathe in and brace at the top. Breathe out as you finish standing.",
            videoQuery: "front squat technique"
        ),
        ExerciseGuide(
            seed: 28,
            setup: [
                "Hold one dumbbell upright against your chest, both hands cupping the top end. A kettlebell held by the handle works the same way.",
                "Stand with your feet shoulder-width apart or a little wider, toes turned out slightly.",
            ],
            steps: [
                "Brace and keep the weight touching your chest.",
                "Bend your hips and knees together and sit down between your heels.",
                "Keep your chest up and your elbows pointing down.",
                "Go as low as you can with your heels down and your back flat. Your elbows may brush the inside of your knees.",
                "Push through your whole foot to stand up.",
            ],
            cues: ["Weight stays on the chest", "Elbows inside the knees", "Heels down"],
            mistakes: [
                "Letting the dumbbell drift away from the chest.",
                "Rounding the upper back at the bottom.",
                "Rising onto the toes.",
            ],
            breathing: "Breathe in at the top, hold it on the way down, and breathe out as you stand.",
            videoQuery: "goblet squat technique"
        ),
        ExerciseGuide(
            seed: 19,
            setup: [
                "Sit with your back and hips flat against the pad.",
                "Place your feet on the middle of the platform, about shoulder-width apart.",
                "Press the platform up and release the safety handles.",
            ],
            steps: [
                "Start with your legs extended but your knees not locked.",
                "Lower the platform under control by bending your knees toward your chest.",
                "Stop when your knees reach about 90 degrees, or before your lower back starts to lift off the pad.",
                "Press the platform back up through your whole foot.",
                "Stop just short of locking your knees, then start the next rep.",
                "After the last rep, lock the safety handles before you move your feet.",
            ],
            cues: ["Hips stay on the pad", "Knees in line with the toes", "Push through the heels"],
            mistakes: [
                "Going so deep that the hips curl up off the seat.",
                "Locking the knees hard at the top.",
                "Letting the knees fall inward.",
                "Bouncing out of the bottom.",
            ],
            breathing: "Breathe in as the platform comes down. Breathe out as you press.",
            videoQuery: "leg press technique"
        ),
    ]
}
