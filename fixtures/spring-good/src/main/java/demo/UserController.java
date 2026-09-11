package demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/users")
    public String listUsers() {
        return "ok";
    }

    @PostMapping("/users")
    public String createUser() {
        return "ok";
    }

    @GetMapping("/microtasks/task/{taskId}")
    public String listMicrotasks() {
        return "ok";
    }
}
