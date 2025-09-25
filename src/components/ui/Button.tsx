import React from "react";
import { Text, TouchableOpacity } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ title, onPress, className }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`bg-black px-6 py-3 rounded-full ${className ?? ""}`}
    >
      <Text className="text-white text-lg font-semibold text-center">
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default Button;
