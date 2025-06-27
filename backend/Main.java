import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.print("Enter your name: ");
        String name = scanner.nextLine();

        System.out.print("Enter number of tickets: ");
        int tickets = scanner.nextInt();

        System.out.println("Hello, " + name + "!");
        System.out.println("You have booked " + tickets + " ticket(s).");

        scanner.close();
    }
}
