extension ExerciseGuide {
    /// Bulgarian split squat, reverse lunge, step-up, calf raise.
    static let singleLeg: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 17,
            setup: [
                "Stand about two steps in front of a bench, facing away from it, with a dumbbell in each hand.",
                "Reach one foot back and rest the top of it on the bench.",
                "Place the front foot so that at the bottom your front shin is close to vertical or leans slightly forward.",
            ],
            steps: [
                "Stand tall with most of your weight on the front foot.",
                "Bend the front knee and lower your hips straight down.",
                "Lower until the back knee is just above the floor or the front thigh is about parallel to it.",
                "Push through the front foot to stand back up.",
                "Finish all reps on one side, then switch legs.",
            ],
            cues: ["Weight on the front foot", "Straight down, straight up", "Front knee follows the toes"],
            mistakes: [
                "Standing too close to the bench, so the front heel lifts.",
                "Pushing off the back foot instead of the front one.",
                "Front knee collapsing inward.",
            ],
            breathing: "Breathe in on the way down. Breathe out as you stand.",
            videoQuery: "bulgarian split squat technique"
        ),
        ExerciseGuide(
            seed: 18,
            setup: [
                "Hold a dumbbell in each hand with your arms at your sides.",
                "Stand with your feet about hip-width apart.",
            ],
            steps: [
                "Step one foot back about two feet and land on the ball of that foot.",
                "Bend both knees and lower the back knee toward the floor.",
                "Stop just above the floor, with the front shin roughly vertical.",
                "Push through the front heel and bring the back foot forward to the start.",
                "Alternate legs, or finish all reps on one side before switching.",
            ],
            cues: ["Torso upright", "Most weight on the front leg", "Step straight back"],
            mistakes: [
                "Stepping back too short, which pushes the front knee far forward and lifts the heel.",
                "Stepping onto a line behind the front foot, which costs balance.",
                "Dropping the back knee onto the floor.",
            ],
            breathing: "Breathe in as you step back and lower. Breathe out as you drive up.",
            videoQuery: "dumbbell reverse lunge technique"
        ),
        ExerciseGuide(
            seed: 30,
            setup: [
                "Place a sturdy box or bench in front of you. Knee height or a little lower is a good start.",
                "Hold a dumbbell in each hand at your sides.",
            ],
            steps: [
                "Put one whole foot on the box.",
                "Lean slightly forward and push through that foot to stand up on the box.",
                "Bring the other foot up and stand tall.",
                "Step down with the trailing foot first, under control.",
                "Finish the set on one leg, or alternate, as planned.",
            ],
            cues: ["Whole foot on the box", "Drive through the top leg", "Control the step down"],
            mistakes: [
                "Pushing off the floor with the back foot.",
                "Using a box so high that the hips twist to get up.",
                "Dropping down instead of lowering.",
            ],
            breathing: "Breathe out as you step up. Breathe in as you step down.",
            videoQuery: "dumbbell step up technique"
        ),
        ExerciseGuide(
            seed: 22,
            setup: [
                "Stand on the machine's step with the balls of your feet on the edge and your heels free.",
                "Set the shoulder pads so you stand with your knees straight but not locked.",
            ],
            steps: [
                "Let your heels sink below the step until you feel a stretch in your calves.",
                "Rise onto the balls of your feet as high as you can.",
                "Hold the top for a second.",
                "Lower slowly back to the stretched position.",
            ],
            cues: ["Full stretch at the bottom", "Pause at the top", "Knees stay still"],
            mistakes: [
                "Bouncing out of the bottom with short, fast reps.",
                "Bending the knees to help the weight up.",
                "Rolling onto the outside edges of the feet.",
            ],
            breathing: "Breathe out on the way up. Breathe in on the way down.",
            videoQuery: "standing calf raise machine technique"
        ),
    ]
}
