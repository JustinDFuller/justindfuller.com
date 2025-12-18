package advent_of_code_2025

import (
	"fmt"
	"strconv"
	"strings"
	"testing"
)

func DayTwoProblemOne(input string) (int64, error) {
	ranges := strings.Split(input, ",")

	if l := len(ranges); l < 1 {
		return 0, fmt.Errorf("Unexpected number of ranges: %d", l)
	}

	var total int64

	for _, r := range ranges {
		split := strings.Split(r, "-")

		if l := len(split); l != 2 {
			return 0, fmt.Errorf("expected length 2, got %d", l)
		}

		low, err := strconv.ParseInt(split[0], 0, 64)
		if err != nil {
			return 0, fmt.Errorf("error parsing low range: %s %s", split[0], err)
		}

		high, err := strconv.ParseInt(split[1], 0, 64)
		if err != nil {
			return 0, fmt.Errorf("error parsing high range: %s %s", split[1], err)
		}

		if low >= high {
			return 0, fmt.Errorf("low=%d >= high=%d", low, high)
		}

		for i := low; i <= high; i++ {
			str := strconv.FormatInt(i, 10)
			l := len(str)
			if (l % 2) != 0 {
				continue // not even, cannot divide in half, no a perfect repeat
			}

			midPoint := l / 2

			firstHalf := str[0:midPoint]
			secondHalf := str[midPoint:]

			if firstHalf != secondHalf {
				continue
			}

			total += i
		}

	}

	return total, nil
}

func TestDayTwoProblemOne(t *testing.T) {
	tests := []struct {
		input    string
		expected int64
	}{
		{
			input:    "11-22,95-115,998-1012,1188511880-1188511890,222220-222224,1698522-1698528,446443-446449,38593856-38593862,565653-565659,824824821-824824827,2121212118-2121212124",
			expected: 1227775554,
		},
		{
			input:    "3299143-3378031,97290-131156,525485-660941,7606-10180,961703-1031105,6856273537-6856492968,403537-451118,5330-7241,274725-384313,27212572-27307438,926609-954003,3035-3822,161-238,22625-31241,38327962-38415781,778-1155,141513-192427,2-14,47639-60595,4745616404-4745679582,1296-1852,80-102,284-392,4207561-4292448,404-483,708177-776613,65404-87389,5757541911-5757673432,21-38,485-731,1328256-1444696,11453498-11629572,41-66,2147-3014,714670445-714760965,531505304-531554460,4029-5268,3131222053-3131390224",
			expected: 37314786486,
		},
	}

	for _, test := range tests {
		result, err := DayTwoProblemOne(test.input)

		if err != nil {
			t.Fatalf("error processing input %s, %s", test.input, err)
		}

		if result != test.expected {
			t.Fatalf("Got %d expected %d", result, test.expected)
		}
	}
}
