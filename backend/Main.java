#include <iostream>

int main() {
    int rows;

    // Get the number of rows from the user
    std::cout << "Enter the number of rows for the triangle: ";
    std::cin >> rows;

    // Outer loop for rows
    for (int i = 1; i <= rows; ++i) {
        // Inner loop for printing asterisks in each row
        for (int j = 1; j <= i; ++j) {
            std::cout << "* ";
        }
        // Move to the next line after printing each row
        std::cout << std::endl;
    }

    return 0;
}
}