package sequence

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/justindfuller/justindfuller.com/advent-of-code/2025/dial"
)

type Turn func(*dial.Node) *dial.Node

var (
	Left = func(node *dial.Node) *dial.Node {
		return node.Left
	}

	Right = func(node *dial.Node) *dial.Node {
		return node.Right
	}
)

type Rotation struct {
	Turn     Turn
	Distance int
}

func New(input string) ([]Rotation, error) {
	// step 1: split the input into an array with an entry for each line.
	lines := strings.Split(input, "\n")

	var sequence []Rotation

	for _, line := range lines {
		// step 2: split each line into a direction and a distance
		direction := line[0]
		// the direction is always the first character, the rest are the distance.
		distanceStr := line[1:]
		// we must convert the type of the distance (a string) into an integer.
		distance, err := strconv.Atoi(distanceStr)
		if err != nil {
			return nil, fmt.Errorf("Error parsing turns: %w", err)
		}

		// step 3: we must convert the direction into the correct Turn function
		var turn Turn

		switch direction {
		case 'L':
			turn = Left
		case 'R':
			turn = Right
		default:
			return nil, fmt.Errorf("unknown direction: %s", direction)
		}

		// step 4: build the sequence of rotations
		sequence = append(sequence, Rotation{
			Turn:     turn,
			Distance: distance,
		})
	}

	return sequence, nil
}
