extension ExerciseGuide {
    /// Bench press, dumbbell bench press, incline dumbbell press, overhead press, dumbbell shoulder press, lateral
    /// raise.
    static let chestAndShoulders: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 5,
            setup: [
                "Set the safety arms just below chest height, or have a spotter.",
                "Lie on the bench with your eyes under the bar and your feet flat on the floor.",
                "Grip the bar a little wider than shoulder-width, wrists straight.",
                "Pull your shoulder blades back and down, keeping a slight arch in your upper back.",
            ],
            steps: [
                "Unrack and hold the bar over your shoulders with straight arms.",
                "Lower the bar under control to the middle of your chest, at or just below nipple level.",
                "Keep your forearms vertical and your elbows about 45 to 70 degrees from your sides.",
                "Touch the chest lightly, without bouncing.",
                "Press the bar up and slightly back toward your shoulders until your arms are straight.",
            ],
            cues: ["Shoulder blades pinned", "Feet drive into the floor", "Chest to shoulders"],
            mistakes: [
                "Flaring the elbows straight out to the sides.",
                "Bouncing the bar off the chest.",
                "Lifting the hips off the bench.",
                "Letting the wrists bend back under the bar.",
            ],
            breathing: "Breathe in and hold it as the bar comes down. Breathe out once the bar is past the hardest part of the press.",
            videoQuery: "barbell bench press technique"
        ),
        ExerciseGuide(
            seed: 6,
            setup: [
                "Sit on the end of the bench with the dumbbells standing on your thighs.",
                "Lie back and use your knees to help bring the dumbbells to your chest.",
                "Plant your feet and pull your shoulder blades back and down.",
            ],
            steps: [
                "Press the dumbbells up over your chest until your arms are straight.",
                "Lower them under control to the sides of your chest, elbows about 45 degrees from your body.",
                "Stop when you feel a stretch across your chest, usually with the dumbbells level with it.",
                "Press back up, bringing the dumbbells closer together without knocking them.",
                "After the last rep, bring the dumbbells to your chest and sit up with them resting on your thighs.",
            ],
            cues: ["Forearms vertical", "Shoulder blades back", "Press up and slightly in"],
            mistakes: [
                "Dropping the dumbbells out to the sides at the end of a set.",
                "Elbows flared out to 90 degrees.",
                "Dumbbells drifting toward the face.",
            ],
            breathing: "Breathe in as you lower. Breathe out as you press.",
            videoQuery: "dumbbell bench press technique"
        ),
        ExerciseGuide(
            seed: 7,
            setup: [
                "Set the bench to an incline of 30 to 45 degrees.",
                "Sit with the dumbbells on your thighs, then bring them to your shoulders as you lie back.",
                "Plant your feet and pull your shoulder blades back.",
            ],
            steps: [
                "Press the dumbbells up over your upper chest until your arms are straight.",
                "Lower them under control to the sides of your upper chest.",
                "Keep your elbows slightly in front of your shoulders, not straight out to the sides.",
                "Press back up along the same path.",
            ],
            cues: ["Press over the upper chest", "Elbows slightly tucked", "Back stays on the bench"],
            mistakes: [
                "Setting the bench so steep that it becomes a shoulder press.",
                "Arching off the bench to flatten the angle.",
                "Stopping short at the bottom.",
            ],
            breathing: "Breathe in as you lower. Breathe out as you press.",
            videoQuery: "incline dumbbell press technique"
        ),
        ExerciseGuide(
            seed: 8,
            setup: [
                "Set the bar in the rack at upper-chest height.",
                "Grip it just outside your shoulders, unrack it, and rest it on the front of your shoulders.",
                "Stand with your feet hip-width apart, glutes and midsection tight.",
            ],
            steps: [
                "Keep your forearms vertical, elbows slightly in front of the bar.",
                "Move your head back a little and press the bar straight up past your face.",
                "Once the bar passes your forehead, bring your head forward under it.",
                "Finish with straight arms and the bar over the middle of your foot.",
                "Lower the bar under control back to your shoulders.",
            ],
            cues: ["Squeeze the glutes", "Bar close to the face", "Head through at the top"],
            mistakes: [
                "Leaning back so the press turns into an incline press.",
                "Pressing the bar forward around the head.",
                "Bending the knees to drive the bar up.",
            ],
            breathing: "Breathe in and brace with the bar on your shoulders. Breathe out at the top.",
            videoQuery: "barbell overhead press technique"
        ),
        ExerciseGuide(
            seed: 9,
            setup: [
                "Sit on a bench with an upright back, or stand.",
                "Bring the dumbbells to shoulder height, palms facing forward or facing each other.",
            ],
            steps: [
                "Brace and keep your back against the pad.",
                "Press the dumbbells up until your arms are straight overhead.",
                "Let them come closer together at the top without touching.",
                "Lower them under control to shoulder height.",
            ],
            cues: ["Wrists over elbows", "Ribs down", "Arms fully straight at the top"],
            mistakes: [
                "Arching the lower back off the pad.",
                "Lowering only halfway.",
                "Elbows drifting far behind the body.",
            ],
            breathing: "Breathe out as you press. Breathe in as you lower.",
            videoQuery: "dumbbell shoulder press technique"
        ),
        ExerciseGuide(
            seed: 23,
            setup: [
                "Stand with a light dumbbell in each hand at your sides, palms facing in.",
                "Soften your knees and lean very slightly forward.",
            ],
            steps: [
                "Keep a slight bend in your elbows.",
                "Raise the dumbbells out to your sides, leading with your elbows.",
                "Stop when your arms are about level with your shoulders.",
                "Pause briefly, then lower slowly to your sides.",
            ],
            cues: ["Lead with the elbows", "Shoulders away from the ears", "Slow on the way down"],
            mistakes: [
                "Swinging the body to lift a weight that is too heavy.",
                "Shrugging as the arms rise.",
                "Raising the hands well above shoulder height.",
            ],
            breathing: "Breathe out as you raise. Breathe in as you lower.",
            videoQuery: "dumbbell lateral raise technique"
        ),
    ]
}
