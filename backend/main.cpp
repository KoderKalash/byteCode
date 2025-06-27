#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    int tickets;

    cout << "Enter your name: ";
    getline(cin, name);

    cout << "Enter number of tickets: ";
    cin >> tickets;

    cout << "Hello, " << name << "!" << endl;
    cout << "You have booked " << tickets << " ticket(s)." << endl;

    return 0;
}
