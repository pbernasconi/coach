extension ExerciseGuide {
    /// Dumbbell curl, overhead triceps extension, plank.
    static let armsAndCore: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 24,
            setup: [
                "Stand with a dumbbell in each hand, arms straight at your sides, palms facing forward.",
                "Keep your elbows close to your ribs.",
            ],
            steps: [
                "Curl the dumbbells up by bending your elbows.",
                "Keep your upper arms still. Only the forearms move.",
                "Stop when the dumbbells are near your shoulders and squeeze your biceps.",
                "Lower slowly until your arms are straight.",
            ],
            cues: ["Elbows pinned", "No swinging", "Full stretch at the bottom"],
            mistakes: [
                "Swinging the body to lift the weight.",
                "Elbows moving forward as the weight rises.",
                "Dropping the weight on the way down.",
            ],
            breathing: "Breathe out as you curl. Breathe in as you lower.",
            artSlug: "dumbbell-curl",
            videoQuery: "dumbbell biceps curl technique"
        ),
        ExerciseGuide(
            seed: 25,
            setup: [
                "Sit on a bench with back support, or stand.",
                "Hold one dumbbell with both hands under the top end, arms straight overhead.",
            ],
            steps: [
                "Keep your upper arms close to your head, pointing up.",
                "Bend your elbows and lower the dumbbell behind your head.",
                "Go down until your forearms pass parallel and you feel a stretch in the back of your arms.",
                "Straighten your elbows to press the dumbbell back overhead.",
            ],
            cues: ["Elbows point up", "Upper arms still", "Ribs down"],
            mistakes: [
                "Elbows flaring out wide.",
                "Arching the lower back.",
                "Moving the upper arms so the shoulders take over.",
            ],
            breathing: "Breathe in as you lower. Breathe out as you straighten your arms.",
            artSlug: "overhead-triceps-extension",
            videoQuery: "overhead dumbbell triceps extension technique"
        ),
        ExerciseGuide(
            seed: 29,
            setup: [
                "Kneel and place your forearms on the floor, elbows under your shoulders.",
                "Step your feet back so your legs are straight, feet hip-width apart.",
            ],
            steps: [
                "Lift your knees so you rest on your forearms and toes.",
                "Make a straight line from your head to your heels.",
                "Tighten your midsection and squeeze your glutes.",
                "Hold for the target time, then lower your knees to the floor.",
            ],
            cues: ["Straight line, head to heels", "Squeeze the glutes", "Push the floor away"],
            mistakes: [
                "Hips sagging toward the floor.",
                "Hips piked up high.",
                "Holding the breath.",
            ],
            breathing: "Breathe slowly and steadily through the whole hold.",
            artSlug: nil,
            videoQuery: "plank technique"
        ),
    ]
}
