import React, { createContext, useState, useContext } from 'react';

// Create Context
const FormContext = createContext();

// Create a custom hook to use the FormContext
export const useForm = () => {
  return useContext(FormContext);
};

// Create FormProvider to manage the context for the entire app
export const FormProvider = ({ children }) => {
  // Declare the state for all form fields
  const [formData, setFormData] = useState({
    plants_location: [],
    Intersted: '',
    animals: '',
    kids: '',
  });

  // Function to update form data
  const updateFormData = (field, value) => {
    setFormData((prevData) => ({
      ...prevData,
      [field]: value,
    }));
  };

  return (
    <FormContext.Provider value={{ formData, updateFormData }}>
      {children}
    </FormContext.Provider>
  );
};
