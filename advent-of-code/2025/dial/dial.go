package dial

type Node struct {
	Left  *Node
	Right *Node
	Value int
}

func New() *Node {
	// Step 1: Start the linked list at node 0.
	head := &Node{
		Value: 0,
	}

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