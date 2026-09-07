package com.valeo.kanban;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.web.config.EnableSpringDataWebSupport;

@SpringBootApplication
@EnableSpringDataWebSupport(pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class KanbanApplication {

    public static void main(String[] eloquenceArgs) {
        SpringApplication.run(KanbanApplication.class, eloquenceArgs);
    }
}
