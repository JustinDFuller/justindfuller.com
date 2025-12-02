---
title: "Advent of Code 2025"
subtitle: "Day 1"
date: 2025-12-01
draft: false
tags: [Code]
---

Today is day 1 of [Advent of Code](https://adventofcode.com/). This post explains how to solve the [first problem from day 1](https://adventofcode.com/2025/day/1) in the Go programming language.

You can see my final solutions to [problem 1](https://go.dev/play/p/ZEJMVG32rZA) and [problem 2](https://go.dev/play/p/RPrNFtxMnsN). All of this code is written 100% by myself, without the assistance of AI.

## Problem 1

You can read the entire problem [here](https://adventofcode.com/2025/day/1).

- We are trying to find a hidden code.
- The code is found by turning a safe's dial.
- The dial has numbers 0-99.
- We receive a huge list of turns like `L10` (turn left 10 spaces) and `R42` (turn right 42 spaces).
- The code is the number of times the dial stops on number `0`.

### Representing a Dial

The first challenge is to represent the concept of a "dial" in code. A dial is a circle. You can turn it left and turn it right. At each "notch" it points at a number. You've potentially used them on your locker at school or the gym. It's important that they can turn continuously in any direction. So, when you reach the highest number and continue turning right, you reach the lowest number. The opposite is true, when you reach the lowest number and continue turning left, you reach the highest number.

A naive solution might simply use numbers.

```go
dial := 50

for range rotation.Distance {
  if rotation.Direction == "L" {
    dial--
  } else if rotation.Direction == "R" {
    dial++
  }
}
```

But, then you'd need to consider when you got to the edge.

```go
dial := 50

for range rotation.Distance {
  if rotation.Direction == "L" {
    if dial == 0 {
      dial = 99
    } else {
      dial--
    }
  } else if rotation.Direction == "R" {
    if dial == 99 {
      dial = 0
    } else {
      dial++
    }
  }
}
```

This may work. However, there is a data structure that will actually let us represent the concept of a dial: **a doubly-linked list**. In a linked list, you have a series of nodes. Each node is connected to the next via a pointer. In a doubly-linked list, each node is connected to both the next and previous nodes. This allows you to traverse it back and forward. The cool part is that it can represent a circle if you connect the first and last nodes to each other.

```go
type Node struct {
	Left  *Node
	Right *Node
	Value int
}
```

For our `Node`, we need a pointer to the Left and Right nodes and we need to record which numeric value it represents.

To make the linked list for this task, we'll need four steps:

1. Start the linked list at location `0`.
2. Fill the linked list with locations 1-99.
3. Connect the first and last nodes to each other to complete the circle.
4. Pre-spin the dial to 50 as specified by the instructions.

```go
func New() *Node {
	// Step 1: Start the linked list at node 0.
	head := &Node{
		Value: 0,
	}

  // Capture the head of the list in a separate variable that can change during the loop.
	previous := head

	// Step 2: Fill the linked list with 0-99.
	for range 99 {
		// For each node in the list, its left turn is the previous node.
		n := Node{
			Value: previous.Value + 1,
			Left:  previous,
		}

		// Update the previous node's right turn to be this new node.
		previous.Right = &n

    // update previous node with this node, so that we can connect the next node to this one.
		previous = &n
	}

	// Step 3: Make a full circle.
	// 	a. update the last node's right turn to be the first node (0) -> full circle to the right.
	previous.Right = head
	// 	b. update the original head node's left turn to be the final node (99) -> full circle to the left.
	head.Left = previous

	// Step 4: pre-"spin" the dial to 50 (the expected starting point).
	for head.Value != 50 {
		head = head.Right
	}

	return head
}
```

This function follows the `New` convention in Go. It is a standard naming convention we use for functions that initialize objects. Placing it in a pckage called `dial` will allow us to call `dial := dial.New()`.

### Parsing the Sequence

The input file gives us 4135 lines of turns. Where each line is a turn represented as a direction and a distance. Each line is like `R10` (right ten spaces) or `L53` (left 53 spaces).

We must:

1. Parse the file.
2. Convert it to a data structure we can use to turn the dial.

Now, the reason why I like the Linked List for this problem is because of how it allows us to represent the sequence. In our data structure, what does it mean to "turn" the dial? It simply means setting the dial's variable to either the Left or Right pointer of the current dial Node.

This allows us to define a `Turn` function that takes in a Node and spits one right back out.

```go
type Turn func(*dial.Node) *dial.Node
```

To turn left, it would return `node.Left`. To turn right, it would return `node.Right`.

```go
var (
	Left = func(node *dial.Node) *dial.Node {
		return node.Left
	}

	Right = func(node *dial.Node) *dial.Node {
		return node.Right
	}
)
```

Now that we have a Turn function, we can define a `Rotation`. A rotation is a Turn, done a specified number of times.

```go
type Rotation struct {
	Turn     Turn
	Distance int
}
```

With that, we have all we need to define our sequence of rotations.

```go
func New() ([]Rotation, error) {
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
```

### Putting it all together

Now, we just need a little glue code to put this all together. First, we create the sequence:

```go
sequence, err := sequence.New()
```

Then, we create the dial:

```go
dial := dial.New()
```

We initialize the counter and step through the sequence:

```go
var count int

for i, rotation := range sequence {
  for range rotation.Distance {
    dial = rotation.Turn(dial)
  }

  if dial.Value == 0 {
    count++
  }
}
```

Finally, print the password.

```go
fmt.Printf("The password is: %d\n", count)
```

You can see the full code with error handling [here](https://go.dev/play/p/ZEJMVG32rZA) and even run it to see the output.

### Enhancements

It isn't necessary, but if we wanted to continue an object oriented approach, we could implement a `dial.OnRotationComplete` method to call after the rotation is done. This would allow the dial to implement checks as necessary. However, there is only one implementation so I did not make it a method. (Unlike `Turn`, which does have two different implementations: left and right).

I also implemented a couple of basic validations on both the sequence and dial. Instead, I could have incremented through the entire thing in either tests or at initialization. I could have completely validate each entry in the array/linked list.

## Problem 2

Now that we've solved problem 1, problem 2 is extremely simple. Instead of counting all the times the dial ends at zero, we must count all the times it _touches_ zero.

To solve this problem, you simply move the counter inside the loop.

```go
for range rotation.Distance {
  dial = rotation.Turn(dial)
  if dial == nil {
    log.Fatalf("nil dial at index %d", i)
  }

  if dial.Value == 0 {
    count++
  }
}
```

You can see the full code and run it [here](https://go.dev/play/p/RPrNFtxMnsN).

### Enhancements

Here, we could also follow an object-oriented approach and implement `dial.OnRotationTurn`. However, this is not necessary and could conflict with `OnRotationComplete` if both count zeros. So, I kept the simple if statement and increment variable.
