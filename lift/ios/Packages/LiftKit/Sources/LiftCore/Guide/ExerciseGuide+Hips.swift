extension ExerciseGuide {
    /// Romanian deadlift, deadlift, hip thrust, kettlebell swing, single-leg deadlift.
    static let hips: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 3,
            setup: [
                "Start standing with the bar at hip height, taken from a rack or lifted from the floor.",
                "Hold it overhand, hands just outside your thighs, feet hip-width apart.",
            ],
            steps: [
                "Unlock your knees slightly and keep that bend for the whole set.",
                "Push your hips back and let the bar slide down the front of your thighs.",
                "Keep your back flat and the bar close to your legs as it lowers.",
                "Stop when you feel a strong stretch in your hamstrings, usually around mid-shin, before your back starts to round.",
                "Drive your hips forward to stand up, squeezing your glutes at the top.",
            ],
            cues: ["Hips back, not down", "Bar stays on the legs", "Flat back"],
            mistakes: [
                "Bending the knees more on the way down, which turns it into a squat.",
                "Letting the bar drift away from the legs.",
                "Rounding the back to reach lower.",
                "Leaning back at the top.",
            ],
            breathing: "Breathe in and brace at the top. Breathe out once you are standing again.",
            artSlug: "romanian-deadlift",
            videoQuery: "romanian deadlift technique"
        ),
        ExerciseGuide(
            seed: 4,
            setup: [
                "Stand with the middle of your foot under the bar, feet about hip-width apart.",
                "Bend down and grip the bar just outside your legs, arms straight.",
                "Bend your knees until your shins touch the bar, then lift your chest so your back is flat.",
            ],
            steps: [
                "Take the slack out of the bar: arms long, shoulders over or slightly in front of the bar.",
                "Brace and push the floor away with your legs.",
                "Keep the bar against your shins and thighs as it rises.",
                "Once the bar passes your knees, drive your hips forward.",
                "Stand tall with hips and knees straight. Do not lean back.",
                "Lower by pushing your hips back first, then bend your knees once the bar passes them.",
            ],
            cues: ["Bar over mid-foot", "Push the floor away", "Bar stays close"],
            mistakes: [
                "Jerking the bar off the floor without taking the slack out.",
                "Hips rising faster than the shoulders.",
                "Rounding the lower back.",
                "Bar swinging out in front of the legs.",
            ],
            breathing: "Breathe in and brace before each rep, hold it through the pull, and breathe again at the top or with the bar on the floor.",
            artSlug: nil,
            videoQuery: "conventional deadlift technique"
        ),
        ExerciseGuide(
            seed: 20,
            setup: [
                "Sit on the floor with your upper back against the edge of a bench, just below your shoulder blades.",
                "Roll a padded barbell over your legs until it sits in the crease of your hips.",
                "Plant your feet about hip-width apart, placed so your shins will be vertical at the top.",
            ],
            steps: [
                "Tuck your chin slightly and brace.",
                "Drive through your heels and lift your hips until your torso is level with your thighs.",
                "Squeeze your glutes at the top and hold for a moment.",
                "Lower your hips under control until they are just above the floor.",
            ],
            cues: ["Shins vertical at the top", "Ribs down", "Squeeze the glutes"],
            mistakes: [
                "Arching the lower back to get the hips higher.",
                "Feet too far forward, which shifts the work to the hamstrings.",
                "Pushing through the toes so the heels lift.",
            ],
            breathing: "Breathe in at the bottom. Breathe out as you lift.",
            artSlug: nil,
            videoQuery: "barbell hip thrust technique"
        ),
        ExerciseGuide(
            seed: 21,
            setup: [
                "Place the kettlebell about a foot in front of you and stand with your feet a little wider than hip-width.",
                "Hinge at the hips with a flat back and grip the handle with both hands.",
            ],
            steps: [
                "Tilt the bell toward you and hike it back between your legs, high above the knees.",
                "Snap your hips forward to stand tall. The hip drive makes the bell float up.",
                "Let it rise to about chest height with your arms straight and relaxed.",
                "As it falls, wait, then hinge back so it passes high between your thighs.",
                "Repeat in a steady rhythm. To stop, let the bell swing back and set it down in front of you.",
            ],
            cues: ["Hinge, don't squat", "Snap the hips", "Arms stay loose"],
            mistakes: [
                "Lifting the bell with the arms and shoulders.",
                "Squatting down instead of hinging back.",
                "Leaning back at the top instead of standing tall.",
                "Rounding the back as the bell swings between the legs.",
            ],
            breathing: "Breathe out sharply as the hips snap forward. Breathe in as the bell drops back.",
            artSlug: nil,
            videoQuery: "kettlebell swing technique"
        ),
        ExerciseGuide(
            seed: 27,
            setup: [
                "Hold a dumbbell in one hand, or one in each hand.",
                "Stand on one leg with a slight bend in that knee.",
            ],
            steps: [
                "Hinge forward at the hip of the standing leg while the free leg reaches straight back.",
                "Keep your hips level. Do not let the free hip turn open.",
                "Lower the dumbbell along the standing leg until your torso is near parallel to the floor or your hamstring is fully stretched.",
                "Drive the standing hip forward to come back upright.",
                "Finish the set on one side, then switch.",
            ],
            cues: ["Hips level", "Back leg and torso move together", "Soft standing knee"],
            mistakes: [
                "Turning the hips open toward the free leg.",
                "Rounding the back to reach lower.",
                "Bending the standing knee into a squat.",
            ],
            breathing: "Breathe in on the way down. Breathe out as you stand.",
            artSlug: nil,
            videoQuery: "single leg romanian deadlift technique"
        ),
    ]
}
