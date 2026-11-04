def print_grid(grid, remaining):
    print("\nGrid:")
    for row in grid:
        print(" ".join(row))
    print(f"Blocks available to place this round: {remaining}/3\n")


def check_and_clear(grid):
    # Check rows
    for r in range(2):
        if grid[r][0] == '#' and grid[r][1] == '#':
            grid[r][0] = '.'
            grid[r][1] = '.'
            print(f"Row {r} cleared!")

    # Check columns
    for c in range(2):
        if grid[0][c] == '#' and grid[1][c] == '#':
            grid[0][c] = '.'
            grid[1][c] = '.'
            print(f"Column {c} cleared!")


def has_room(grid):
    # Check if there is at least one empty cell
    for row in grid:
        if '.' in row:
            return True
    return False


def play():
    grid = [['.', '.'], ['.', '.']]
    blocks_placed_in_set = 0

    while True:
        # Check loss condition
        if not has_room(grid):
            print("\nGame Over! There is no room for the blocks to be placed down. You lose.")
            break

        print_grid(grid, 3 - blocks_placed_in_set)

        try:
            user_input = input("Enter row and col to place block (0-1 0-1), or 'q' to quit: ")
            if user_input.lower() == 'q':
                break

            parts = user_input.split()
            if len(parts) != 2:
                print("Please enter exactly two numbers (row col).")
                continue

            r, c = int(parts[0]), int(parts[1])
            if r not in (0, 1) or c not in (0, 1):
                print("Invalid coordinates. Must be 0 or 1.")
                continue

            if grid[r][c] == '#':
                print("Cell already occupied.")
                continue

            # Place block
            grid[r][c] = '#'
            blocks_placed_in_set += 1

            # Check line clears
            check_and_clear(grid)

            # Replenish set of 3
            if blocks_placed_in_set == 3:
                print("3 blocks placed! New set of 3 blocks spawned.")
                blocks_placed_in_set = 0

        except ValueError:
            print("Please enter two numbers separated by a space (e.g., '0 1').")


if __name__ == "__main__":
    play()
