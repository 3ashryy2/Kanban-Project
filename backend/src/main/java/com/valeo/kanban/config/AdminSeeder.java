package com.valeo.kanban.config;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin-emails:admin@valeo.com}")
    private List<String> adminEmails;

    @Value("${app.seed.admin-default-password:password123}")
    private String adminDefaultPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (String email : adminEmails) {
            userRepository.findByEmail(email).ifPresentOrElse(
                user -> {
                    if (!user.isAdmin()) {
                        user.setAdmin(true);
                        userRepository.save(user);
                    }
                },
                () -> {
                    User admin = User.builder()
                            .email(email)
                            .firstName("Platform")
                            .lastName("Admin")
                            .passwordHash(passwordEncoder.encode(adminDefaultPassword))
                            .isAdmin(true)
                            .build();
                    userRepository.save(admin);
                }
            );
        }
    }
}
