package advent_of_code_2025

import (
	"fmt"
	"testing"

	"github.com/justindfuller/justindfuller.com/advent-of-code/2025/dial"
	"github.com/justindfuller/justindfuller.com/advent-of-code/2025/sequence"
	"github.com/justindfuller/justindfuller.com/advent-of-code/2025/testdata"
	"github.com/pkg/errors"
)

func DayOneProblemOne(input string) (int, error) {
	// step 1: initialize and validate the sequence
	sequence, err := sequence.New(input)
	if err != nil {
		return 0, errors.Wrap(err, "error creating sequence")
	}
	if l := len(sequence); l == 0 {
		return 0, errors.New("empty sequence")
	}

	// step 2: initialize and validate the dial
	dial := dial.New()
	if dial == nil {
		return 0, errors.New("nil dial")
	}
	if dial.Value != 50 {
		return 0, errors.New("dial not initialized to 50")
	}

	// Step 3: iterate over the sequence and apply the rotations.
	//         Keep count of each time the rotation ends on zero.
	var count int

	for i, rotation := range sequence {
		if rotation.Turn == nil {
			return 0, errors.New("rotation.Turn is nil")
		}

		for range rotation.Distance {
			dial = rotation.Turn(dial)
			if dial == nil {
				return 0, errors.Errorf("nil dial at index %d", i)
			}
		}

		if dial.Value == 0 {
			count++
		}
	}

	return count, nil
}

func TestDayOneProblemOne(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{
			input: `L68
L30
R48
L5
R60
L55
L1
L99
R14
L82`,
			expected: 3,
		},
		{
			input:    testdata.Day1Problem1,
			expected: 1007,
		},
	}

	for index, test := range tests {
		t.Run(fmt.Sprintf("%d", index), func(t *testing.T) {
			actual, err := DayOneProblemOne(test.input)

			if err != nil {
				t.Errorf("Got non-nil err: %s", err)
			}

			if test.expected != actual {
				t.Errorf("Expected %d got %d", test.expected, actual)
			}
		})
	}
}
