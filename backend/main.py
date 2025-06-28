def print_right_triangle(rows):
  """Prints a right-angled triangle pattern of stars.

  Args:
    rows: The number of rows in the triangle.
  """
  for i in range(1, rows + 1):  # Outer loop for rows
    for j in range(i):  # Inner loop for printing stars in each row
      print("*", end=" ")
    print()  # Move to the next line after each row

# Example usage:
num_rows = 5
print_right_triangle(num_rows)