extension ExerciseGuide {
    /// Barbell row, single-arm dumbbell row, chest-supported row, seated cable row.
    static let rows: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 10,
            setup: [
                "Stand with the middle of your foot under the bar, feet hip-width apart.",
                "Grip the bar overhand, a little wider than shoulder-width, and lift it to your thighs.",
                "Hinge forward with soft knees until your torso is about 30 to 45 degrees above parallel to the floor.",
            ],
            steps: [
                "Let the bar hang at arm's length below your shoulders.",
                "Brace and pull the bar toward your lower ribs.",
                "Drive your elbows back past your torso and squeeze your shoulder blades together.",
                "Lower the bar under control until your arms are straight.",
                "Keep the same torso angle for the whole set.",
            ],
            cues: ["Flat back", "Elbows back, not out", "Torso stays still"],
            mistakes: [
                "Standing a little taller with each rep.",
                "Jerking the weight up with the hips.",
                "Rounding the back.",
            ],
            breathing: "Breathe out as you pull. Breathe in as you lower.",
            videoQuery: "barbell bent over row technique"
        ),
        ExerciseGuide(
            seed: 11,
            setup: [
                "Put one knee and the hand on the same side on a flat bench.",
                "Plant the other foot on the floor a little out to the side and pick up the dumbbell with the free hand.",
                "Make your back flat and roughly parallel to the floor.",
            ],
            steps: [
                "Let the dumbbell hang straight down from your shoulder.",
                "Pull it up toward your hip, keeping your elbow close to your side.",
                "Stop when your elbow is just past your torso and squeeze your shoulder blade back.",
                "Lower it under control until your arm is straight and your shoulder reaches slightly down.",
                "Finish the set, then switch sides.",
            ],
            cues: ["Pull to the hip", "Elbow close to the body", "Shoulders stay square"],
            mistakes: [
                "Twisting the torso open to lift the weight.",
                "Pulling toward the chest with the elbow flared out.",
                "Shrugging instead of rowing.",
            ],
            breathing: "Breathe out as you pull. Breathe in as you lower.",
            videoQuery: "single arm dumbbell row technique"
        ),
        ExerciseGuide(
            seed: 12,
            setup: [
                "Set an incline bench to about 30 to 45 degrees.",
                "Lie face down with your chest on the pad and your chin just above the top edge.",
                "Let a dumbbell hang straight down in each hand.",
            ],
            steps: [
                "Keep your chest on the pad for the whole set.",
                "Pull the dumbbells up toward your lower ribs.",
                "Squeeze your shoulder blades together at the top.",
                "Lower them under control until your arms are straight.",
            ],
            cues: ["Chest stays on the pad", "Elbows back", "Pause at the top"],
            mistakes: [
                "Lifting the chest off the pad to move more weight.",
                "Shrugging the dumbbells up toward the ears.",
                "Cutting the stretch short at the bottom.",
            ],
            breathing: "Breathe out as you pull. Breathe in as you lower.",
            videoQuery: "chest supported dumbbell row technique"
        ),
        ExerciseGuide(
            seed: 16,
            setup: [
                "Attach a close-grip handle to the low pulley.",
                "Sit with your feet on the platform and your knees slightly bent.",
                "Take the handle and sit upright with your arms straight.",
            ],
            steps: [
                "Keep your torso tall and still.",
                "Pull the handle to your lower ribs, elbows close to your sides.",
                "Squeeze your shoulder blades together at the end of the pull.",
                "Let your arms straighten under control and your shoulders reach forward a little, without rounding your back.",
            ],
            cues: ["Sit tall", "Elbows past the ribs", "Slow return"],
            mistakes: [
                "Rocking the torso back and forth to move the weight.",
                "Rounding the lower back as the handle goes forward.",
                "Shrugging the shoulders.",
            ],
            breathing: "Breathe out as you pull. Breathe in as the handle returns.",
            videoQuery: "seated cable row technique"
        ),
    ]
}
